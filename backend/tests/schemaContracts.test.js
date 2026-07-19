const { teacherRolesZod } = require('../schemas/teacherRoles');
const { learningOutcomesZod } = require('../schemas/learningOutcomes');
const { curriculumSkillsZod } = require('../schemas/curriculumSkills');

const factor = { factor: 'Digital readiness', direction: 'increases_risk', relative_weight: 0.6, evidence: 'Limited recent training.' };
const base = { contributing_factors: [factor, { ...factor, factor: 'AI tool use', direction: 'decreases_risk', relative_weight: 0.4 }], recommended_actions: ['Run a workshop', 'Set a review date'], confidence: 0.72, caveats: 'This is an LLM-reasoned, associational assessment, not a trained causal model.' };

test('teacher roles contract requires the complete common prediction shape', () => {
  expect(teacherRolesZod.parse({ ...base, ai_disruption_exposure_score: 61, exposure_band: 'high', reskilling_priority: 'high' }).confidence).toBe(0.72);
  expect(() => teacherRolesZod.parse({ ai_disruption_exposure_score: 61, exposure_band: 'high', reskilling_priority: 'high' })).toThrow();
});

test('learning outcomes contract is cohort-level structured output', () => {
  expect(learningOutcomesZod.parse({ ...base, pass_rate_resilience_score: 58, trajectory_band: 'at_risk' }).trajectory_band).toBe('at_risk');
});

test('curriculum contract includes score, band, factors, actions, confidence, and caveats', () => {
  const subject = { name: 'Mathematics', weight: 1, vulnerability: 0.5, rationale: 'Knowledge-heavy units dominate.', modernization: 'Add applied verification projects.' };
  expect(curriculumSkillsZod.parse({ ...base, subjects: [subject], curriculum_readiness_score: 55, readiness_band: 'moderate_risk', future_skills_score: 55, summary: 'Needs more applied work.' }).readiness_band).toBe('moderate_risk');
});
