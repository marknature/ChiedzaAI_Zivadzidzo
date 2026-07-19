jest.mock('../services/openaiService', () => ({ runStructuredPrediction: jest.fn() }));

const { runStructuredPrediction } = require('../services/openaiService');
const { createAudit } = require('../auditService');

const input = {
  title: 'Form 3 Mathematics',
  gradeLevel: 'Form 3',
  syllabusText: 'Algebra, geometry, applied problem solving, and a practical data investigation.',
  alpha: 0.8,
};

beforeEach(() => jest.resetAllMocks());

test('legacy audit remains an LLM-only structured assessment and calculates readiness server-side', async () => {
  runStructuredPrediction.mockResolvedValue({
    result: {
      subjects: [
        { name: 'Algebra', weight: 0.6, vulnerability: 0.5, rationale: 'Mostly knowledge work.', modernization: 'Add verification projects.' },
        { name: 'Data investigation', weight: 0.4, vulnerability: 0.2, rationale: 'Applied reasoning.', modernization: 'Use real datasets.' },
      ],
      future_skills_score: 70,
      summary: 'A balanced curriculum with room for more applied AI literacy.',
      recommendations: ['Add verification projects.', 'Use real datasets.'],
    },
    modelUsed: 'gpt-4o-2024-11-20',
    costUsd: 0.001,
  });

  const audit = await createAudit(input);

  expect(runStructuredPrediction).toHaveBeenCalledTimes(1);
  expect(audit.analysisMode).toBe('openai');
  expect(audit.modelVersion).toContain('gpt-4o-2024-11-20::curriculum_skills_v1');
  expect(audit.readinessIndex).toBe(65.6);
});

test('legacy audit does not substitute a heuristic result when OpenAI is unavailable', async () => {
  const unavailable = Object.assign(new Error('OPENAI_API_KEY is not configured.'), { code: 'OPENAI_NOT_CONFIGURED' });
  runStructuredPrediction.mockRejectedValue(unavailable);

  await expect(createAudit(input)).rejects.toMatchObject({ code: 'OPENAI_NOT_CONFIGURED' });
});
