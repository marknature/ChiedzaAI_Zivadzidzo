const { runStructuredPrediction } = require('./openaiService');
const { calculateReadiness } = require('../auditService');
const { curriculumSkillsSchema, curriculumSkillsZod, curriculumSkillsSystemPrompt } = require('../schemas/curriculumSkills');
const { rejectLearnerIdentifiers } = require('./privacyService');

const MAX_CURRICULUM_INPUT_CHARS = 16000;
const MAX_TITLE_CHARS = 160;
const MAX_GRADE_LEVEL_CHARS = 120;
const MAX_SUBJECT_CHARS = 120;
const MAX_TOPIC_CHARS = 160;
const MAX_BREAKDOWN_SUBJECTS = 12;
const MAX_TOPICS_PER_SUBJECT = 12;
const CURRICULUM_INPUT_FIELDS = new Set(['title', 'gradeLevel', 'syllabusText', 'alpha', 'subjectTopicBreakdown']);

function validationError(message) {
  const error = new Error(message);
  error.code = 'VALIDATION';
  return error;
}

function nonEmptyString(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw validationError(`${label} must be a non-empty string.`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw validationError(`${label} must be ${maximum} characters or fewer.`);
  return normalized;
}

function normalizeSubjectTopicBreakdown(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BREAKDOWN_SUBJECTS) {
    throw validationError(`subjectTopicBreakdown must contain between 1 and ${MAX_BREAKDOWN_SUBJECTS} subjects when provided.`);
  }

  rejectLearnerIdentifiers(value);
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw validationError(`subjectTopicBreakdown[${index}] must be an object with subject and topics.`);
    }
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes('subject') || !keys.includes('topics')) {
      throw validationError(`subjectTopicBreakdown[${index}] must contain only subject and topics.`);
    }
    const subject = nonEmptyString(entry.subject, `subjectTopicBreakdown[${index}].subject`, MAX_SUBJECT_CHARS);
    if (!Array.isArray(entry.topics) || entry.topics.length < 1 || entry.topics.length > MAX_TOPICS_PER_SUBJECT) {
      throw validationError(`subjectTopicBreakdown[${index}].topics must contain between 1 and ${MAX_TOPICS_PER_SUBJECT} items.`);
    }
    const topics = entry.topics.map((topic, topicIndex) => nonEmptyString(topic, `subjectTopicBreakdown[${index}].topics[${topicIndex}]`, MAX_TOPIC_CHARS));
    return { subject, topics };
  });
}

function subjectTopicBreakdownCharacters(breakdown) {
  return breakdown.reduce((total, entry) => total + entry.subject.length + entry.topics.reduce((topicTotal, topic) => topicTotal + topic.length, 0), 0);
}

function validateCurriculumSkillsInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw validationError('Curriculum Skills input must be an object.');
  }
  rejectLearnerIdentifiers(rawInput);
  const unexpectedFields = Object.keys(rawInput).filter((key) => !CURRICULUM_INPUT_FIELDS.has(key));
  if (unexpectedFields.length) {
    throw validationError(`Curriculum Skills accepts only title, gradeLevel, syllabusText, alpha, and subjectTopicBreakdown. Remove unsupported fields: ${unexpectedFields.join(', ')}.`);
  }

  const syllabusText = nonEmptyString(rawInput.syllabusText, 'syllabusText', MAX_CURRICULUM_INPUT_CHARS);
  if (syllabusText.length < 12) throw validationError('Please provide at least a short syllabus or course outline.');
  const title = rawInput.title === undefined || rawInput.title === null || rawInput.title === ''
    ? 'Untitled curriculum'
    : nonEmptyString(rawInput.title, 'title', MAX_TITLE_CHARS);
  const gradeLevel = rawInput.gradeLevel === undefined || rawInput.gradeLevel === null || rawInput.gradeLevel === ''
    ? null
    : nonEmptyString(rawInput.gradeLevel, 'gradeLevel', MAX_GRADE_LEVEL_CHARS);
  const alpha = rawInput.alpha === undefined ? 0.8 : rawInput.alpha;
  if (typeof alpha !== 'number' || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw validationError('alpha must be a number between 0 and 1.');
  const subjectTopicBreakdown = normalizeSubjectTopicBreakdown(rawInput.subjectTopicBreakdown);
  if (syllabusText.length + subjectTopicBreakdownCharacters(subjectTopicBreakdown) > MAX_CURRICULUM_INPUT_CHARS) {
    throw validationError(`The syllabus and subject/topic breakdown together must be ${MAX_CURRICULUM_INPUT_CHARS} characters or fewer.`);
  }

  return { title, gradeLevel, syllabusText, alpha, subjectTopicBreakdown };
}

function formatSubjectTopicBreakdown(subjectTopicBreakdown) {
  if (!subjectTopicBreakdown.length) {
    return 'No structured subject/topic breakdown was supplied; use only the syllabus.';
  }
  return subjectTopicBreakdown.map(({ subject, topics }) => `- ${subject}: ${topics.join('; ')}`).join('\n');
}

function buildCurriculumUserContent({ title, gradeLevel, syllabusText, subjectTopicBreakdown = [] }) {
  return `Curriculum: ${title}\n` +
    `Level: ${gradeLevel || 'Not specified'}\n\n` +
    `Structured subject/topic breakdown:\n${formatSubjectTopicBreakdown(subjectTopicBreakdown)}\n\n` +
    `Syllabus:\n${syllabusText}`;
}

// Reuses the audits table's exact SRI formula (calculateReadiness) so the product's
// signature explainable metric stays deterministic. The LLM produces a subject-level
// breakdown; the final readiness score is independently calculated server-side.
function readinessBand(score) {
  if (score >= 70) return 'ai_ready';
  if (score >= 50) return 'moderate_risk';
  return 'high_obsolescence';
}

function subjectsToContributingFactors(subjects) {
  return subjects.map((subject) => ({
    factor: subject.name,
    direction: subject.vulnerability > 0.5 ? 'increases_risk' : 'decreases_risk',
    relative_weight: subject.weight,
    evidence: subject.rationale,
  }));
}

async function runCurriculumSkillsPrediction(input) {
  const normalized = validateCurriculumSkillsInput(input);
  const userContent = buildCurriculumUserContent(normalized);

  const { result, modelUsed, costUsd } = await runStructuredPrediction({
    schema: curriculumSkillsSchema,
    zodSchema: curriculumSkillsZod,
    systemPrompt: curriculumSkillsSystemPrompt,
    userContent,
  });

  const curriculumReadinessScore = calculateReadiness(result.subjects, result.future_skills_score, normalized.alpha);

  return {
    curriculum_readiness_score: curriculumReadinessScore,
    readiness_band: readinessBand(curriculumReadinessScore),
    contributing_factors: subjectsToContributingFactors(result.subjects),
    recommended_actions: result.recommended_actions,
    confidence: result.confidence,
    caveats: result.caveats,
    subjects: result.subjects,
    future_skills_score: result.future_skills_score,
    summary: result.summary,
    modelUsed,
    costUsd,
    normalizedInput: normalized,
  };
}

module.exports = {
  runCurriculumSkillsPrediction,
  readinessBand,
  validateCurriculumSkillsInput,
  normalizeSubjectTopicBreakdown,
  buildCurriculumUserContent,
  formatSubjectTopicBreakdown,
  MAX_CURRICULUM_INPUT_CHARS,
};
