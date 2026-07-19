// Strict JSON Schema for the Curriculum & Future Skills predict head. This is the mandatory
// prompt.md shape (score+band, contributing_factors, recommended_actions, confidence, caveats)
// layered on top of the existing subject-breakdown shape from auditService.js's auditSchema -
// the subject breakdown itself is unchanged (still what the SRI formula consumes), it just
// now also carries confidence + caveats so it fits the same predictions-table contract as
// the other two heads. See backend/services/curriculumService.js for how subjects[] gets
// turned into contributing_factors and the SRI score.
const curriculumSkillsSchema = {
  name: 'curriculum_skills_audit',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['subjects', 'future_skills_score', 'summary', 'recommendations', 'confidence', 'caveats'],
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
      future_skills_score: { type: 'number', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
      recommendations: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      caveats: { type: 'string' },
    },
  },
};

const curriculumSkillsSystemPrompt = `You are ZivaDzidzo, a careful curriculum-modernization analyst. Analyse only the \
supplied syllabus. Estimate automation vulnerability as a learning-design risk, never as a judgement of teachers or \
learners. Give concrete, age-appropriate modernization steps. The "caveats" field must state, specific to this \
syllabus, that this is an LLM-reasoned structured output (not a trained model's output) and that the vulnerability \
scores are associational/plausibility-ranked, not a mechanistic decomposition like SHAP - do not write a generic \
disclaimer, write one grounded in what was just analysed.`;

module.exports = { curriculumSkillsSchema, curriculumSkillsSystemPrompt };
