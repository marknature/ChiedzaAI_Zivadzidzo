// Strict JSON Schema for the Curriculum & Future Skills predict head. This is the mandatory
// prompt.md shape (score+band, contributing_factors, recommended_actions, confidence, caveats)
// layered on top of the existing subject-breakdown shape from auditService.js's auditSchema -
// the subject breakdown itself is unchanged (still what the SRI formula consumes), it just
// now also carries confidence + caveats so it fits the same predictions-table contract as
// the other two heads. See backend/services/curriculumService.js for how subjects[] gets
// turned into contributing_factors and the SRI score.
const { z, contributingFactorZod } = require('./contracts');

const curriculumSkillsZod = z.object({
  subjects: z.array(z.object({ name: z.string().min(1), weight: z.number().min(0.05).max(1), vulnerability: z.number().min(0).max(1), rationale: z.string().min(1), modernization: z.string().min(1) }).strict()).min(1).max(8),
  curriculum_readiness_score: z.number().min(0).max(100),
  readiness_band: z.enum(['ai_ready', 'moderate_risk', 'high_obsolescence']),
  future_skills_score: z.number().min(0).max(100),
  summary: z.string().min(1),
  contributing_factors: z.array(contributingFactorZod).min(2).max(6),
  recommended_actions: z.array(z.string().min(1)).min(2).max(5),
  confidence: z.number().min(0).max(1),
  caveats: z.string().min(1),
}).strict();

const curriculumSkillsSchema = {
  name: 'curriculum_skills_audit',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['subjects', 'curriculum_readiness_score', 'readiness_band', 'future_skills_score', 'summary', 'contributing_factors', 'recommended_actions', 'confidence', 'caveats'],
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
            modernization: { type: 'string' },
          },
        },
      },
      curriculum_readiness_score: { type: 'number', minimum: 0, maximum: 100 },
      readiness_band: { type: 'string', enum: ['ai_ready', 'moderate_risk', 'high_obsolescence'] },
      future_skills_score: { type: 'number', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
      contributing_factors: {
        type: 'array', minItems: 2, maxItems: 6, items: {
          type: 'object', additionalProperties: false, required: ['factor', 'direction', 'relative_weight', 'evidence'],
          properties: { factor: { type: 'string' }, direction: { type: 'string', enum: ['increases_risk', 'decreases_risk'] }, relative_weight: { type: 'number', minimum: 0, maximum: 1 }, evidence: { type: 'string' } },
        },
      },
      recommended_actions: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      caveats: { type: 'string' },
    },
  },
};

const curriculumSkillsSystemPrompt = `You are ZivaDzidzo, a careful curriculum-modernization analyst. Analyse only the \
supplied syllabus. Estimate automation vulnerability as a learning-design risk, never as a judgement of teachers or \
learners. Give concrete, age-appropriate modernization steps. Return curriculum_readiness_score and readiness_band as \
a reasoned estimate; the backend will independently compute the final score from subjects and future_skills_score. \
Each contributing factor must cite a syllabus-grounded signal, and recommended_actions must be specific next moves. The "caveats" field must state, specific to this \
syllabus, that this is an LLM-reasoned structured output (not a trained model's output) and that the vulnerability \
scores are associational/plausibility-ranked, not a mechanistic decomposition like SHAP - do not write a generic \
disclaimer, write one grounded in what was just analysed.`;

module.exports = { curriculumSkillsSchema, curriculumSkillsZod, curriculumSkillsSystemPrompt };
