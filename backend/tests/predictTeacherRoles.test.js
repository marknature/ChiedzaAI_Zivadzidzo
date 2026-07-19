const { computeTeacherRolesEngineeredFeatures } = require('../services/predictionService');
const { runStructuredPrediction } = require('../services/openaiService');
const { teacherRolesSchema, teacherRolesSystemPrompt } = require('../schemas/teacherRoles');
const { findStudentIdentifierFields } = require('../services/predictionService');

describe('computeTeacherRolesEngineeredFeatures', () => {
  test('digital_readiness_index and training_hours_per_year_of_service match the documented formulas', () => {
    const result = computeTeacherRolesEngineeredFeatures({
      years_experience: 5,
      training_hours: 20,
      digital_skills_score: 60,
      ai_tool_usage_frequency: 'sometimes', // numeric 2
    });
    // digital_readiness_index = 0.5*60 + 0.3*(2*20) + 0.2*min(20/40,1)*100 = 30 + 12 + 10 = 52
    expect(result.digital_readiness_index).toBeCloseTo(52, 5);
    // training_hours_per_year_of_service = 20 / max(5,1) = 4
    expect(result.training_hours_per_year_of_service).toBeCloseTo(4, 5);
  });

  test('years_experience of 0 is floored to 1 (no divide-by-zero)', () => {
    const result = computeTeacherRolesEngineeredFeatures({
      years_experience: 0,
      training_hours: 10,
      digital_skills_score: 50,
      ai_tool_usage_frequency: 'never',
    });
    expect(result.training_hours_per_year_of_service).toBeCloseTo(10, 5);
  });

  test('missing/unknown ai_tool_usage_frequency defaults to numeric 0, not NaN', () => {
    const result = computeTeacherRolesEngineeredFeatures({
      years_experience: 3,
      training_hours: 0,
      digital_skills_score: 40,
      ai_tool_usage_frequency: null,
    });
    expect(Number.isNaN(result.digital_readiness_index)).toBe(false);
    expect(result.digital_readiness_index).toBeCloseTo(20, 5); // 0.5*40 + 0 + 0
  });
});

test('nested student identifiers are detected before cohort prediction input reaches the model', () => {
  expect(findStudentIdentifierFields({ cohort: { learnerName: 'Protected learner' } })).toEqual(['$.cohort.learnerName']);
  expect(findStudentIdentifierFields({ historicalPassRates: [{ period: 'Term 1', passRatePercent: 56 }] })).toEqual([]);
});

// Prompt regression suite (prompt.md Phase 1, item 7): synthetic profiles across the
// readiness spectrum, asserted against EXPECTED RANGES rather than exact values - LLM
// output isn't deterministic enough for exact-match assertions even at temperature 0.
// Skipped entirely when OPENAI_API_KEY isn't configured (e.g. local dev, CI without the
// secret) rather than failing the build - this mirrors the demo-mode-friendly convention
// already used elsewhere in this backend.
const SYNTHETIC_PROFILES = [
  { label: 'veteran, low digital skills, never uses AI, no training', years_experience: 22, training_hours: 0, digital_skills_score: 15, ai_tool_usage_frequency: 'never', expectedBands: ['high', 'critical'] },
  { label: 'new teacher, low digital skills, rarely uses AI, minimal training', years_experience: 1, training_hours: 2, digital_skills_score: 20, ai_tool_usage_frequency: 'rarely', expectedBands: ['high', 'critical'] },
  { label: 'mid-career, moderate digital skills, sometimes uses AI', years_experience: 10, training_hours: 15, digital_skills_score: 50, ai_tool_usage_frequency: 'sometimes', expectedBands: ['moderate', 'high'] },
  { label: 'mid-career, high digital skills, often uses AI, solid training', years_experience: 8, training_hours: 30, digital_skills_score: 78, ai_tool_usage_frequency: 'often', expectedBands: ['low', 'moderate'] },
  { label: 'veteran, high digital skills, daily AI use, heavy training', years_experience: 18, training_hours: 50, digital_skills_score: 92, ai_tool_usage_frequency: 'daily', expectedBands: ['low', 'moderate'] },
  { label: 'new teacher, high digital skills, daily AI use', years_experience: 1, training_hours: 25, digital_skills_score: 85, ai_tool_usage_frequency: 'daily', expectedBands: ['low', 'moderate'] },
  { label: 'mid-career, low digital skills, never uses AI, some training', years_experience: 12, training_hours: 10, digital_skills_score: 25, ai_tool_usage_frequency: 'never', expectedBands: ['moderate', 'high', 'critical'] },
  { label: 'veteran, moderate digital skills, rarely uses AI', years_experience: 25, training_hours: 5, digital_skills_score: 45, ai_tool_usage_frequency: 'rarely', expectedBands: ['moderate', 'high'] },
  { label: 'new teacher, moderate digital skills, sometimes uses AI', years_experience: 2, training_hours: 12, digital_skills_score: 55, ai_tool_usage_frequency: 'sometimes', expectedBands: ['moderate', 'high'] },
  { label: 'mid-career, very high digital skills, daily AI use, max training', years_experience: 6, training_hours: 60, digital_skills_score: 98, ai_tool_usage_frequency: 'daily', expectedBands: ['low'] },
  { label: 'veteran, very low digital skills, never uses AI, no training', years_experience: 30, training_hours: 0, digital_skills_score: 5, ai_tool_usage_frequency: 'never', expectedBands: ['high', 'critical'] },
  { label: 'mid-career, high digital skills, never uses AI (skills without adoption)', years_experience: 9, training_hours: 8, digital_skills_score: 80, ai_tool_usage_frequency: 'never', expectedBands: ['low', 'moderate', 'high'] },
];

const describeIfConfigured = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeIfConfigured('teacher-roles predict head - prompt regression suite', () => {
  test.each(SYNTHETIC_PROFILES)('$label -> exposure_band within expected range', async (profile) => {
    const engineered = computeTeacherRolesEngineeredFeatures(profile);
    const userContent = `Teacher: Synthetic Test Profile\n` +
      `Years of teaching experience: ${profile.years_experience}\n` +
      `Self/admin-rated digital skills score (0-100): ${profile.digital_skills_score}\n` +
      `AI tool usage frequency: ${profile.ai_tool_usage_frequency}\n` +
      `Training hours in the last 12 months: ${profile.training_hours}\n` +
      `Engineered feature - training hours per year of service: ${engineered.training_hours_per_year_of_service}\n` +
      `Engineered feature - digital readiness index (0-100): ${engineered.digital_readiness_index}\n\n` +
      `Assess this teacher's AI-disruption exposure and reskilling priority.`;

    const { result } = await runStructuredPrediction({
      schema: teacherRolesSchema,
      systemPrompt: teacherRolesSystemPrompt,
      userContent,
    });

    expect(profile.expectedBands).toContain(result.exposure_band);
    expect(result.ai_disruption_exposure_score).toBeGreaterThanOrEqual(0);
    expect(result.ai_disruption_exposure_score).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.contributing_factors.length).toBeGreaterThanOrEqual(2);
    expect(typeof result.caveats).toBe('string');
    expect(result.caveats.length).toBeGreaterThan(0);
  }, 30000);
});

if (!process.env.OPENAI_API_KEY) {
  test('prompt regression suite skipped (no OPENAI_API_KEY configured)', () => {
    expect(true).toBe(true);
  });
}
