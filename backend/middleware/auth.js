const { supabase } = require('../db');
const supabaseService = require('../services/supabaseService');

// Verifies the bearer token against Supabase (no manual JWKS handling needed - the
// anon-key client can validate a user's own token via auth.getUser), then attaches the
// caller's profile (institution_id, role) so routes never have to re-derive it.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing bearer token.' });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session.' });
  }

  // Keep the profile lookup under the caller's JWT. Querying through the global
  // anon client bypasses the authenticated RLS context and can make valid users
  // look unprovisioned once profiles RLS is enabled.
  const client = supabaseService.clientForToken(token);
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, institution_id, role, full_name')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ success: false, error: 'Could not load user profile.' });
  }
  if (!profile) {
    // Authenticated with Supabase but no profiles row yet - the client must call
    // POST /auth/session-sync right after sign-in/sign-up before hitting any other route.
    return res.status(409).json({ success: false, error: 'Profile not provisioned. Call /auth/session-sync first.' });
  }

  req.user = userData.user;
  req.profile = profile;
  req.authToken = token;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.profile || !allowedRoles.includes(req.profile.role)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
