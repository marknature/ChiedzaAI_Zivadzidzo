const express = require('express');
const { supabase, supabaseAdmin } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Called once right after Supabase sign-in/sign-up. Institution membership and role
// are assigned by a trusted administrator or invite flow, never by a self-service
// "first school" fallback. That prevents a new account from silently joining the
// wrong tenant or gaining a role through client-controlled profile fields.
router.post('/session-sync', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing bearer token.' });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session.' });
  }
  const user = userData.user;

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id, institution_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (existingProfileError) {
    return res.status(500).json({ success: false, error: 'Could not look up profile.' });
  }
  if (existingProfile) {
    return res.status(200).json({ success: true, profile: existingProfile, created: false });
  }

  return res.status(403).json({
    success: false,
    error: 'Your account is awaiting assignment by an institution administrator.',
    code: 'MEMBERSHIP_PENDING',
  });
});

router.get('/me', requireAuth, (req, res) => res.json({ success: true, profile: req.profile }));

module.exports = router;
