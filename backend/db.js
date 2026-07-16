const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// 🛡️ Manual file read backup (supports VITE_ prefixes too!)
if (!supabaseUrl || !supabaseKey) {
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] ? match[2].trim() : '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        
        // Accept standard or VITE prefixed keys
        if (key === 'SUPABASE_URL' || key === 'VITE_SUPABASE_URL') {
          supabaseUrl = value;
        }
        if (key === 'SUPABASE_ANON_KEY' || key === 'VITE_SUPABASE_PUBLISHABLE_KEY') {
          supabaseKey = value;
        }
      }
    });
  }
}

let supabase;

if (!supabaseUrl || !supabaseKey) {
  console.error("\n❌ ERROR: Still missing Supabase variables!");
  console.error("👉 Read attempt from:", envPath);
  console.error("Please make sure your .env contains either standard or VITE_ keys.\n");
  
  supabase = {
    from: () => ({
      insert: () => ({
        select: () => Promise.resolve({ data: null, error: new Error("Supabase is unconfigured.") })
      })
    })
  };
} else {
  console.log("✅ Supabase credentials loaded successfully!");
  console.log("🔗 URL:", supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = supabase;