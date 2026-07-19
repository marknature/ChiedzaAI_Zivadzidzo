const { findLearnerIdentifierFields } = require('../services/privacyService');
const { validateLearningOutcomesInput } = require('../services/predictionService');

const validInput = {
  subjectName: 'Mathematics',
  gradeLevel: 'Form 3',
  cohortSize: 42,
  aiToolExposureLevel: 35,
  curriculumDeliveryContext: 'Teacher-guided, project-based lessons with limited connectivity.',
  historicalPassRates: [
    { period: '2025 Term 1', passRatePercent: 58 },
    { period: '2025 Term 2', passRatePercent: 64 },
  ],
};

test('Learning Outcomes accepts only the documented cohort aggregate shape', () => {
  expect(validateLearningOutcomesInput(validInput)).toEqual(validInput);
});

test('Learning Outcomes rejects nested learner identifiers before any model call', () => {
  expect(() => validateLearningOutcomesInput({ ...validInput, cohort: { learnerName: 'Protected learner' } }))
    .toThrow(/aggregate learning data only/i);
});

test('Learning Outcomes rejects unknown top-level fields and invalid nested history fields', () => {
  expect(() => validateLearningOutcomesInput({ ...validInput, studentEmail: 'learner@example.com' }))
    .toThrow(/learner identifiers/i);
  expect(() => validateLearningOutcomesInput({
    ...validInput,
    historicalPassRates: [{ period: '2025 Term 1', passRatePercent: 58, learnerId: 'L-10' }],
  })).toThrow(/learner identifiers/i);
});

test('privacy scanner catches identifier keys despite spacing or casing', () => {
  expect(findLearnerIdentifierFields({ 'Student ID': 'A-12', records: [{ Learner_Email: 'person@example.com' }] }))
    .toEqual(['$.Student ID', '$.records[0].Learner_Email', '$.records[0].Learner_Email contains an email address']);
});

test('privacy scanner catches learner identifiers in free-text inputs', () => {
  expect(findLearnerIdentifierFields('Learner name: Chipo Moyo')).toEqual(['$ contains a learner identifier']);
  expect(findLearnerIdentifierFields('How can a cohort improve its pass rate?')).toEqual([]);
});
