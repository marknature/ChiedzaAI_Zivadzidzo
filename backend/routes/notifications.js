const express = require('express');
const { requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const { userRequestLimiter } = require('../middleware/security');
const router = express.Router();
router.use(requireAuth);
router.use(userRequestLimiter);

router.post('/token', async (req, res) => {
  const token = req.body?.expoPushToken;
  if (typeof token !== 'string' || !/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(token)) return res.status(400).json({ success: false, error: 'A valid Expo push token is required.' });
  try { const client = supabaseService.clientForToken(req.authToken); const saved = await supabaseService.upsertPushToken(client, { institutionId: req.profile.institution_id, profileId: req.profile.id, expoPushToken: token }); res.status(201).json({ success: true, token: saved }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
module.exports = router;
