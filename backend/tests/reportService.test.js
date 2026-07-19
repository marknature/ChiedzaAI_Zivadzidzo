const { reportContent, displayTimestamp, buildDocx, buildPdf } = require('../services/reportService');

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

test('Word and PDF exports include a renderable decision-support report', async () => {
  const content = reportContent({
    model_version: 'gpt-4o-2024-11-20::curriculum_skills_v1',
    prediction: {
      curriculum_readiness_score: 61,
      readiness_band: 'moderate_risk',
      recommended_actions: ['Add an applied AI-literacy project.'],
    },
    rationale: {
      contributing_factors: [{ factor: 'Applied learning', relative_weight: 0.7, evidence: 'Assessment is primarily recall-based.' }],
    },
  }, 'Curriculum Skills prediction', '2026-07-19T10:00:00.000Z');

  const [docx, pdf] = await Promise.all([buildDocx(content), buildPdf(content)]);
  expect(Buffer.isBuffer(docx)).toBe(true);
  expect(Buffer.isBuffer(pdf)).toBe(true);
  expect(docx.length).toBeGreaterThan(1000);
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
});
