// One-off hackathon-demo helper: creates (or reuses) a Supabase auth user and assigns
// it an 'admin' profiles row on the seeded demo institution, so the app can be signed
// into immediately without the manual SQL-editor profile-assignment step in the README.
// Safe to re-run - it looks up existing rows before inserting.
require('dotenv').config({ quiet: true });
const { supabaseAdmin } = require('../db');

const INSTITUTION_NAME = 'ZivaDzidzo Pilot Secondary School';
const DEMO_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'demo@zivadzidzo.app';
const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'ZivaDzidzoDemo!25';
const DEMO_NAME = 'Demo Admin';

async function main() {
  const { data: institution, error: institutionError } = await supabaseAdmin
    .from('institutions')
    .select('id')
    .eq('name', INSTITUTION_NAME)
    .maybeSingle();
  if (institutionError) throw new Error(`Could not look up institution: ${institutionError.message}`);
  if (!institution) throw new Error(`Institution "${INSTITUTION_NAME}" not found - run "npm run seed" first.`);

  // createUser fails if the email already exists; look it up via listUsers instead of
  // relying on catching that error, so re-runs stay clean either way.
  let userId;
  const { data: existingList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw new Error(`Could not list users: ${listError.message}`);
  const existingUser = existingList.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Demo auth user already exists (id=${userId}). Resetting password to the demo value.`);
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
    if (updateError) throw new Error(`Could not reset demo user password: ${updateError.message}`);
  } else {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (createError) throw new Error(`Could not create demo auth user: ${createError.message}`);
    userId = created.user.id;
    console.log(`Created demo auth user (id=${userId}).`);
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert([{ id: userId, institution_id: institution.id, full_name: DEMO_NAME, role: 'admin' }], { onConflict: 'id' });
  if (profileError) throw new Error(`Could not upsert demo profile: ${profileError.message}`);

  console.log('\nDemo login is ready:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  role:     admin @ ${INSTITUTION_NAME} (${institution.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demo admin setup failed:', error.message);
    process.exit(1);
  });
