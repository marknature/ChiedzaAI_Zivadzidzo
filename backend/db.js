const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Manual file read backup (supports VITE_ prefixes too), mirrors the original setup.
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] ? match[2].trim() : '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

        if (key === 'SUPABASE_URL' || key === 'VITE_SUPABASE_URL') supabaseUrl = supabaseUrl || value;
        if (key === 'SUPABASE_ANON_KEY' || key === 'VITE_SUPABASE_PUBLISHABLE_KEY') supabaseAnonKey = supabaseAnonKey || value;
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseServiceRoleKey = supabaseServiceRoleKey || value;
      }
    });
  }
}

function unconfiguredClientStub(label) {
  const error = () => Promise.resolve({ data: null, error: new Error(`Supabase (${label}) is unconfigured.`) });
  return {
    from: () => ({ insert: () => ({ select: error }), select: error, update: () => ({ eq: error }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: new Error(`Supabase (${label}) is unconfigured.`) }) },
  };
}

let supabase; // anon-key client: used for every user-scoped operation, RLS-enforced.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\n❌ ERROR: Missing SUPABASE_URL / SUPABASE_ANON_KEY.');
  console.error('👉 Read attempt from:', envPath);
  supabase = unconfiguredClientStub('anon');
} else {
  console.log('✅ Supabase anon client configured. URL:', supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// service-role client: ONLY for privileged backend-only operations (report storage
// writes, auto-logging LLM cost entries). Never constructed with anything but the
// service role key, and this module never exports the key itself.
let supabaseAdmin;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  supabaseAdmin = unconfiguredClientStub('service-role');
} else {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = supabase;
module.exports.supabase = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
