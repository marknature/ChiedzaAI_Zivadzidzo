const { reportContent, displayTimestamp } = require('../services/reportService');

test('prediction reports carry an executive summary, evidence, caveat, and reproducibility metadata', () => {
  const content = reportContent({
    model_version: 'gpt-4o-2024-11-20::teacher_roles_v1',
    prediction: {
      ai_disruption_exposure_score: 72,
      exposure_band: 'high',
      recommended_actions: ['Run a focused digital-skills workshop.'],
    },
    rationale: {
      contributing_factors: [{
        factor: 'Digital readiness',
        relative_weight: 0.6,
        evidence: 'Recent training is limited.',
      }],
      caveats: 'Decision support only.',
    },
  }, 'Teacher Roles prediction', '2026-07-19T10:00:00.000Z');

  expect(content.score).toBe(72);
  expect(content.band).toBe('high');
  expect(content.executiveSummary).toContain('Digital readiness');
  expect(content.executiveSummary).toContain('Run a focused digital-skills workshop.');
  expect(content.modelVersion).toBe('gpt-4o-2024-11-20::teacher_roles_v1');
  expect(content.caveats).toBe('Decision support only.');
  expect(content.factors).toHaveLength(1);
});

test('report timestamps are rendered in an unambiguous UTC format', () => {
  expect(displayTimestamp('2026-07-19T10:00:00.000Z')).toBe('2026-07-19 10:00:00 UTC');
  expect(displayTimestamp('not-a-date')).toBe('Not available');
});
