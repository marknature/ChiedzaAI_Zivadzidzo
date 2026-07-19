// Strict JSON Schema for the Teacher Roles predict head (prompt.md Section 6.2 / 6.3).
// Every predict head schema must carry: a score+band, contributing_factors, recommended_actions,
// confidence, and a caveats string that is specific to this prediction, not a generic disclaimer.
const { z, predictionCommonZod } = require('./contracts');

const teacherRolesZod = z.object({
  ai_disruption_exposure_score: z.number().min(0).max(100),
  exposure_band: z.enum(['low', 'moderate', 'high', 'critical']),
  reskilling_priority: z.enum(['low', 'medium', 'high', 'urgent']),
  ...predictionCommonZod,
}).strict();

const teacherRolesSchema = {
  name: 'teacher_ai_disruption_assessment',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'ai_disruption_exposure_score',
      'exposure_band',
      'reskilling_priority',
      'contributing_factors',
      'recommended_actions',
      'confidence',
      'caveats',
    ],
    properties: {
      ai_disruption_exposure_score: { type: 'number', minimum: 0, maximum: 100 },
      exposure_band: { type: 'string', enum: ['low', 'moderate', 'high', 'critical'] },
      reskilling_priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      contributing_factors: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['factor', 'direction', 'relative_weight', 'evidence'],
          properties: {
            factor: { type: 'string' },
            direction: { type: 'string', enum: ['increases_risk', 'decreases_risk'] },
            relative_weight: { type: 'number', minimum: 0, maximum: 1 },
            evidence: { type: 'string' },
          },
        },
      },
      recommended_actions: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: { type: 'string' },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      caveats: { type: 'string' },
    },
  },
};

const teacherRolesSystemPrompt = `You are ZivaDzidzo, an education-workforce analyst assessing how exposed a specific \
teacher's role is to AI-driven disruption, and how urgently they need reskilling support. You are reasoning from \
engineered features about one teacher, not a trained model - be specific to the inputs given, never generic. \
Estimate exposure as a structural/role-design signal, never as a judgement of the teacher's competence or worth. \
The "caveats" field must state, specific to this prediction, that this is an LLM-reasoned structured output (not a \
trained model's output) and that contributing_factors are associational/plausibility-ranked, not a mechanistic \
decomposition like SHAP - do not write a generic disclaimer, write one grounded in what was just predicted.`;

module.exports = { teacherRolesSchema, teacherRolesZod, teacherRolesSystemPrompt };
