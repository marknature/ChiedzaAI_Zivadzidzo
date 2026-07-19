const express = require('express');
const { supabase, supabaseAdmin } = require('../db');
const { ROLES } = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Called once right after Supabase sign-in/sign-up. Verifies the token, then
// provisions (or returns) the caller's profiles row. Uses the service-role client
// deliberately: a brand-new user has no profiles row yet, so RLS on `profiles`/
// `institutions` would otherwise block them from bootstrapping their own account.
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

  // Single-institution mode (Phase 0): every new profile joins the one seeded
  // institution. The schema stays multi-tenant-ready; only this lookup is naive.
  const { data: institution, error: institutionError } = await supabaseAdmin
    .from('institutions')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (institutionError || !institution) {
    return res.status(500).json({ success: false, error: 'No institution is configured yet. Run the seed script first.' });
  }

  const fullName = req.body?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'New teacher';
  const { data: newProfile, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert([{ id: user.id, institution_id: institution.id, full_name: fullName, role: ROLES.TEACHER }])
    .select('id, institution_id, role, full_name')
    .single();
  if (insertError) {
    return res.status(500).json({ success: false, error: `Could not provision profile: ${insertError.message}` });
  }

  res.status(201).json({ success: true, profile: newProfile, created: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ success: true, profile: req.profile }));

module.exports = router;
