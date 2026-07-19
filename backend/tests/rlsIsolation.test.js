/*
 * Live RLS proof. Configure two normal test-user JWTs and their institution IDs in CI;
 * the test deliberately asks user A's client for user B's rows and must receive none.
 */
const { createClient } = require('@supabase/supabase-js');

const configured = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'RLS_TEST_USER_A_TOKEN', 'RLS_TEST_USER_B_INSTITUTION_ID'].every((key) => Boolean(process.env[key]));
const describeRls = configured ? describe : describe.skip;

describeRls('cross-institution RLS isolation', () => {
  const clientA = configured ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${process.env.RLS_TEST_USER_A_TOKEN}` } }, auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const foreignInstitutionId = process.env.RLS_TEST_USER_B_INSTITUTION_ID;
  test.each(['departments', 'teachers', 'predictions', 'chat_sessions', 'reports', 'cost_entries'])('%s does not expose foreign-institution rows', async (table) => {
    const { data, error } = await clientA.from(table).select('id').eq('institution_id', foreignInstitutionId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
