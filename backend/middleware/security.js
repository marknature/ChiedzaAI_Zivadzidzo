const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../config');

const byUser = new Map();
const byAuthenticatedUser = new Map();

function isLoopbackRequest(req) {
  const address = String(req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');
  return address === '127.0.0.1' || address === '::1';
}
function userRequestLimiter(req, res, next) {
  if (!req.profile) return next();
  const now = Date.now(); const key = req.profile.id; const record = byAuthenticatedUser.get(key) || { started: now, count: 0 };
  if (now - record.started > RATE_LIMITS.WINDOW_MS) { record.started = now; record.count = 0; }
  record.count += 1; byAuthenticatedUser.set(key, record);
  if (record.count > RATE_LIMITS.MAX_PER_USER) return res.status(429).json({ success: false, error: 'User rate limit reached. Please try again later.' });
  next();
}
function userPredictionLimiter(req, res, next) {
  if (!req.profile) return next();
  const now = Date.now(); const key = req.profile.id; const record = byUser.get(key) || { started: now, count: 0 };
  if (now - record.started > RATE_LIMITS.WINDOW_MS) { record.started = now; record.count = 0; }
  record.count += 1; byUser.set(key, record);
  if (record.count > RATE_LIMITS.MAX_PREDICT_PER_USER) return res.status(429).json({ success: false, error: 'Prediction rate limit reached. Please try again later.' });
  next();
}

const ipLimiter = rateLimit({
  windowMs: RATE_LIMITS.WINDOW_MS,
  limit: RATE_LIMITS.MAX_PER_IP,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Keep production protection intact while local Expo/browser testing can reload
  // freely without exhausting a shared development IP budget.
  skip: (req) => process.env.NODE_ENV !== 'production' && isLoopbackRequest(req),
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
module.exports = { ipLimiter, userRequestLimiter, userPredictionLimiter };
