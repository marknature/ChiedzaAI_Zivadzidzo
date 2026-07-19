const {
  isPriorityPrediction,
  buildPriorityNotificationMessages,
  invalidExpoTokens,
} = require('../services/notificationService');

test('priority notification eligibility uses task bands that exist in the structured contracts', () => {
  expect(isPriorityPrediction({ prediction: { reskilling_priority: 'high' } })).toBe(true);
  expect(isPriorityPrediction({ prediction: { trajectory_band: 'at_risk' } })).toBe(true);
  expect(isPriorityPrediction({ prediction: { readiness_band: 'high_obsolescence' } })).toBe(true);
  expect(isPriorityPrediction({ prediction: { trajectory_band: 'improving' } })).toBe(false);
});

test('notification payload is generic and routes to the aggregate dashboard', () => {
  const messages = buildPriorityNotificationMessages(['ExponentPushToken[one]'], {
    id: 'prediction-id',
    task_type: 'learning_outcomes',
    prediction: { trajectory_band: 'at_risk' },
  });

  expect(messages).toEqual([expect.objectContaining({
    to: 'ExponentPushToken[one]',
    title: 'Priority assessment ready',
    data: { screen: 'Dashboard', predictionId: 'prediction-id', taskType: 'learning_outcomes' },
  })]);
  expect(messages[0].body).not.toMatch(/learner|teacher name|student/i);
});

test('invalid Expo tickets identify only their matching device tokens for cleanup', () => {
  expect(invalidExpoTokens([
    { status: 'ok' },
    { status: 'error', details: { error: 'DeviceNotRegistered' } },
  ], ['ExponentPushToken[one]', 'ExponentPushToken[two]']))
    .toEqual(['ExponentPushToken[two]']);
});
