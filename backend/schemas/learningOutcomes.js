// Strict JSON Schema for the Learning Outcomes predict head (prompt.md Section 6.2 pattern,
// applied to this head). Cohort/subject-level only - this head must NEVER be called with an
// individual student identifier as input (see the route's input validation and
// prompt.md's "Student data" rule / KNOWN_LIMITATIONS.md).
const { z, predictionCommonZod } = require('./contracts');

const learningOutcomesZod = z.object({
  pass_rate_resilience_score: z.number().min(0).max(100),
  trajectory_band: z.enum(['declining', 'at_risk', 'stable', 'improving']),
  ...predictionCommonZod,
}).strict();

const learningOutcomesSchema = {
  name: 'learning_outcomes_trajectory_assessment',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'pass_rate_resilience_score',
      'trajectory_band',
      'contributing_factors',
      'recommended_actions',
      'confidence',
      'caveats',
    ],
    properties: {
      pass_rate_resilience_score: { type: 'number', minimum: 0, maximum: 100 },
      trajectory_band: { type: 'string', enum: ['declining', 'at_risk', 'stable', 'improving'] },
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

const learningOutcomesSystemPrompt = `You are ZivaDzidzo, an education analyst assessing how a subject/grade cohort's pass-rate \
trajectory is likely to hold up as AI-tool exposure rises in the classroom. You reason ONLY from cohort/subject-level \
aggregate statistics - you are never given, and must never ask for or infer, any individual student's name, ID, or \
identifiable record. If the input looks like it is describing a named individual rather than a cohort, treat the \
cohort-level fields only and ignore anything that looks like a personal identifier. \
Estimate "pass_rate_resilience_score" as how well this cohort's outcomes are likely to hold up, not a judgement of \
any teacher or student. The "caveats" field must state, specific to this prediction, that this is an LLM-reasoned \
structured output (not a trained model's output), that contributing_factors are associational/plausibility-ranked \
(not a mechanistic decomposition like SHAP), and that inputs are cohort-level aggregates only, never individual \
student records.`;

module.exports = { learningOutcomesSchema, learningOutcomesZod, learningOutcomesSystemPrompt };
