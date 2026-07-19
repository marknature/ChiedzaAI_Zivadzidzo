const { z } = require('zod');

// Runtime mirrors of the strict OpenAI JSON schemas. These are deliberately reused by
// all three heads so the common prediction contract cannot drift between implementations.
const contributingFactorZod = z.object({
  factor: z.string().min(1),
  direction: z.enum(['increases_risk', 'decreases_risk']),
  relative_weight: z.number().min(0).max(1),
  evidence: z.string().min(1),
}).strict();

const predictionCommonZod = {
  contributing_factors: z.array(contributingFactorZod).min(2).max(6),
  recommended_actions: z.array(z.string().min(1)).min(2).max(5),
  confidence: z.number().min(0).max(1),
  caveats: z.string().min(1),
};

module.exports = { z, contributingFactorZod, predictionCommonZod };
