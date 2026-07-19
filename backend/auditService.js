const OpenAI = require('openai');
const { OPENAI_MODELS } = require('./config');

const MAX_SYLLABUS_CHARS = 16000;

const auditSchema = {
  name: 'curriculum_audit',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['subjects', 'future_skills_score', 'summary', 'recommendations'],
    properties: {
      subjects: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'weight', 'vulnerability', 'rationale', 'modernization'],
          properties: {
            name: { type: 'string' },
            weight: { type: 'number', minimum: 0.05, maximum: 1 },
            vulnerability: { type: 'number', minimum: 0, maximum: 1 },
            rationale: { type: 'string' },
            modernization: { type: 'string' }
          }
        }
      },
      future_skills_score: { type: 'number', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
      recommendations: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } }
    }
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function calculateReadiness(subjects, futureSkillsScore, alpha = 0.8) {
  const totalWeight = subjects.reduce((sum, subject) => sum + subject.weight, 0) || 1;
  const resilience = subjects.reduce(
    (sum, subject) => sum + (subject.weight / totalWeight) * (1 - subject.vulnerability),
    0
  );
  return Number(((resilience + clamp(alpha, 0, 1) * (futureSkillsScore / 100)) * 100).toFixed(1));
}

function normalizeAudit(audit) {
  const subjects = audit.subjects.map((subject) => ({
    name: String(subject.name).slice(0, 80),
    weight: clamp(subject.weight, 0.05, 1),
    vulnerability: clamp(subject.vulnerability, 0, 1),
    rationale: String(subject.rationale).slice(0, 360),
    modernization: String(subject.modernization).slice(0, 240)
  }));

  return {
    subjects,
    futureSkillsScore: clamp(audit.future_skills_score, 0, 100),
    summary: String(audit.summary).slice(0, 500),
    recommendations: audit.recommendations.map(String).slice(0, 5)
  };
}

function fallbackAudit(syllabusText) {
  const lines = syllabusText
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^\s*(unit|module|topic|week|chapter)\s*\d*\s*[:.-]?\s*/i, '').trim())
    .filter((line) => line.length > 3)
    .slice(0, 5);
  const topics = lines.length ? lines : ['Foundational concepts', 'Applied practice', 'Systems thinking'];
  const lower = syllabusText.toLowerCase();
  const hasPractice = /project|practical|lab|portfolio|case study|fieldwork/.test(lower);
  const hasAI = /ai|artificial intelligence|machine learning|data literacy|prompt/.test(lower);
  const hasCriticalThinking = /critical thinking|ethics|problem.solving|collaborat/.test(lower);
  const futureSkillsScore = Math.min(95, 35 + (hasPractice ? 25 : 0) + (hasAI ? 25 : 0) + (hasCriticalThinking ? 15 : 0));

  return {
    subjects: topics.map((name, index) => {
      const isPractical = /project|practical|lab|design|system|research|ethic|clinical/.test(name.toLowerCase());
      return {
        name,
        weight: 1 / topics.length,
        vulnerability: isPractical ? 0.3 : Math.min(0.86, 0.72 + index * 0.04),
        rationale: isPractical
          ? 'Applied work and judgement make this area more resilient to automation.'
          : 'The topic appears knowledge-heavy; learners need more applied, AI-supported work.',
        modernization: isPractical
          ? 'Add an AI-assisted reflection and evidence-based assessment rubric.'
          : 'Add a practical challenge where learners verify, critique, and improve AI output.'
      };
    }),
    futureSkillsScore,
    summary: 'Demo-mode analysis based on the syllabus language. Add an OpenAI API key for a deeper, curriculum-specific audit.',
    recommendations: [
      'Assess evidence, judgement, and iteration—not recall alone.',
      'Add one authentic project with responsible AI collaboration.',
      'Teach learners to verify sources and challenge AI-generated answers.'
    ]
  };
}

async function analyzeWithOpenAI({ title, gradeLevel, syllabusText }) {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODELS.PREDICT,
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: auditSchema },
    messages: [
      {
        role: 'system',
        content: 'You are ZivaDzidzo, a careful curriculum-modernization analyst. Analyse only the supplied syllabus. Estimate automation vulnerability as a learning-design risk, never as a judgement of teachers or learners. Give concrete, age-appropriate modernization steps.'
      },
      {
        role: 'user',
        content: `Curriculum: ${title}\nLevel: ${gradeLevel || 'Not specified'}\n\nSyllabus:\n${syllabusText.slice(0, MAX_SYLLABUS_CHARS)}`
      }
    ]
  });
  return normalizeAudit(JSON.parse(completion.choices[0].message.content));
}

async function createAudit(input) {
  const aiAudit = await analyzeWithOpenAI(input);
  const audit = aiAudit || fallbackAudit(input.syllabusText);
  return {
    ...audit,
    readinessIndex: calculateReadiness(audit.subjects, audit.futureSkillsScore, input.alpha),
    analysisMode: aiAudit ? 'openai' : 'demo'
  };
}

module.exports = { createAudit, calculateReadiness };
