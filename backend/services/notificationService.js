const { supabaseAdmin } = require('../db');
const { TABLES, ROLES } = require('../config');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const NOTIFICATION_ROLES = new Set([ROLES.ADMIN, ROLES.HEAD_TEACHER]);

function isPriorityPrediction(prediction) {
  const value = prediction?.prediction || prediction || {};
  return ['critical', 'urgent'].includes(value.exposure_band)
    || ['high', 'urgent'].includes(value.reskilling_priority)
    || ['declining', 'at_risk'].includes(value.trajectory_band)
    || value.readiness_band === 'high_obsolescence';
}

function buildPriorityNotificationMessages(tokens, prediction) {
  const label = String(prediction.task_type || 'prediction').replace(/_/g, ' ');
  return tokens.map((to) => ({
    to,
    sound: 'default',
    title: 'Priority assessment ready',
    body: `A ${label} assessment needs prompt attention.`,
    data: {
      screen: 'Dashboard',
      predictionId: prediction.id,
      taskType: prediction.task_type,
    },
  }));
}

function invalidExpoTokens(ticketData, tokens) {
  if (!Array.isArray(ticketData)) return [];
  return ticketData.flatMap((ticket, index) => {
    const invalid = ticket?.details?.error === 'DeviceNotRegistered' || ticket?.details?.error === 'InvalidCredentials';
    return invalid && tokens[index] ? [tokens[index]] : [];
  });
}

async function notifyPriorityPrediction({ institutionId, prediction }) {
  if (!isPriorityPrediction(prediction)) return { sent: 0, skipped: true, reason: 'not_priority' };
  const { data: tokenRows, error: tokenError } = await supabaseAdmin
    .from(TABLES.PUSH_TOKENS)
    .select('expo_push_token, profile_id')
    .eq('institution_id', institutionId);
  if (tokenError) throw new Error(`Could not load notification recipients: ${tokenError.message}`);
  if (!tokenRows?.length) return { sent: 0, skipped: true, reason: 'no_tokens' };

  const profileIds = [...new Set(tokenRows.map((row) => row.profile_id).filter(Boolean))];
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from(TABLES.PROFILES)
    .select('id, role, institution_id')
    .eq('institution_id', institutionId)
    .in('id', profileIds);
  if (profileError) throw new Error(`Could not load notification recipient roles: ${profileError.message}`);
  const eligibleProfileIds = new Set((profiles || []).filter((profile) => NOTIFICATION_ROLES.has(profile.role)).map((profile) => profile.id));
  const tokens = tokenRows.filter((row) => eligibleProfileIds.has(row.profile_id)).map((row) => row.expo_push_token);
  if (!tokens.length) return { sent: 0, skipped: true, reason: 'no_eligible_recipients' };

  const messages = buildPriorityNotificationMessages(tokens, prediction);
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`Expo push service returned ${response.status}.`);
  const payload = await response.json().catch(() => ({}));
  const invalidTokens = invalidExpoTokens(payload.data, tokens);
  if (invalidTokens.length) {
    const { error } = await supabaseAdmin.from(TABLES.PUSH_TOKENS).delete().in('expo_push_token', invalidTokens);
    if (error) console.warn('Could not remove invalid Expo tokens:', error.message);
  }
  return { sent: messages.length, skipped: false, invalidTokens: invalidTokens.length };
}

module.exports = {
  isPriorityPrediction,
  buildPriorityNotificationMessages,
  invalidExpoTokens,
  notifyPriorityPrediction,
};
