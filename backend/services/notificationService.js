const { supabaseAdmin } = require('../db');
const { TABLES } = require('../config');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isPriorityPrediction(prediction) {
  const value = prediction?.prediction || prediction || {};
  return ['critical', 'urgent'].includes(value.exposure_band) || ['critical', 'urgent'].includes(value.reskilling_priority)
    || ['critical', 'urgent'].includes(value.trajectory_band) || ['critical', 'urgent'].includes(value.readiness_band);
}

async function notifyPriorityPrediction({ institutionId, prediction }) {
  if (!isPriorityPrediction(prediction)) return { sent: 0, skipped: true };
  const { data: tokens, error } = await supabaseAdmin.from(TABLES.PUSH_TOKENS).select('expo_push_token').eq('institution_id', institutionId);
  if (error) throw new Error(`Could not load notification recipients: ${error.message}`);
  if (!tokens?.length) return { sent: 0, skipped: true };
  const label = String(prediction.task_type || 'prediction').replace(/_/g, ' ');
  const messages = tokens.map(({ expo_push_token: to }) => ({ to, sound: 'default', title: 'Priority assessment ready', body: `A ${label} assessment needs prompt attention.`, data: { predictionId: prediction.id, taskType: prediction.task_type } }));
  const response = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' }, body: JSON.stringify(messages) });
  if (!response.ok) throw new Error(`Expo push service returned ${response.status}.`);
  return { sent: messages.length, skipped: false };
}

module.exports = { isPriorityPrediction, notifyPriorityPrediction };
