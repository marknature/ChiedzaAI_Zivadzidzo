const { runStructuredPrediction } = require('./openaiService');
const { calculateReadiness } = require('../auditService');
const { curriculumSkillsSchema, curriculumSkillsZod, curriculumSkillsSystemPrompt } = require('../schemas/curriculumSkills');

const MAX_SYLLABUS_CHARS = 16000;

// Reuses the audits table's exact SRI formula (calculateReadiness, unchanged in
// auditService.js) so the product's signature "explainable math formula" pitch stays
// deterministic and doesn't quietly become an LLM guess. The LLM only supplies the
// subject-level breakdown; the score itself is computed here, server-side.
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

async function runCurriculumSkillsPrediction({ title, gradeLevel, syllabusText, alpha = 0.8 }) {
  const userContent = `Curriculum: ${title}\nLevel: ${gradeLevel || 'Not specified'}\n\nSyllabus:\n${syllabusText.slice(0, MAX_SYLLABUS_CHARS)}`;

  const { result, modelUsed, costUsd } = await runStructuredPrediction({
    schema: curriculumSkillsSchema,
    zodSchema: curriculumSkillsZod,
    systemPrompt: curriculumSkillsSystemPrompt,
    userContent,
  });

  const curriculumReadinessScore = calculateReadiness(result.subjects, result.future_skills_score, alpha);

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
  };
}

module.exports = { runCurriculumSkillsPrediction, readinessBand };
