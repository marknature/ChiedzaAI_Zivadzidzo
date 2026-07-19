const { createClient } = require('@supabase/supabase-js');
const { supabase: anonClient, supabaseAdmin, supabaseUrl, supabaseAnonKey } = require('../db');
const { TABLES } = require('../config');

// Per-request client authenticated as the calling user (anon key + their JWT). Queries made
// with this client run under Postgres RLS as that user - this is the "everything server-side
// still goes through RLS" rule from prompt.md, so a bug in a route can't silently read/write
// across institutions. Only privileged, backend-only operations should use supabaseAdmin
// directly instead of this.
function clientForToken(token) {
  if (!supabaseUrl || !supabaseAnonKey) return anonClient; // unconfigured-stub fallback, same as db.js
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function listTeachers(client, institutionId) {
  const { data, error } = await client
    .from(TABLES.TEACHERS)
    .select('id, full_name, subject_id, years_experience, ai_tool_usage_frequency, digital_skills_score, training_hours, last_assessed_at')
    .eq('institution_id', institutionId)
    .order('full_name', { ascending: true });
  if (error) throw new Error(`Could not list teachers: ${error.message}`);
  return data;
}

async function getTeacherById(client, id) {
  const { data, error } = await client
    .from(TABLES.TEACHERS)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Could not load teacher: ${error.message}`);
  return data;
}

async function insertTeacher(client, teacher) {
  const { data, error } = await client.from(TABLES.TEACHERS).insert([teacher]).select().single();
  if (error) throw new Error(`Could not create teacher: ${error.message}`);
  return data;
}

async function updateTeacher(client, id, patch) {
  const { data, error } = await client.from(TABLES.TEACHERS).update(patch).eq('id', id).select().single();
  if (error) throw new Error(`Could not update teacher: ${error.message}`);
  return data;
}

async function insertPrediction(client, prediction) {
  const { data, error } = await client.from(TABLES.PREDICTIONS).insert([prediction]).select().single();
  if (error) throw new Error(`Could not save prediction: ${error.message}`);
  return data;
}

async function listPredictions(client, institutionId, taskType, targetRefId) {
  let query = client
    .from(TABLES.PREDICTIONS)
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });
  if (taskType) query = query.eq('task_type', taskType);
  if (targetRefId) query = query.eq('target_ref_id', targetRefId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not list predictions: ${error.message}`);
  return data;
}

// Privileged: inserts an auto-tracked LLM cost entry. Uses supabaseAdmin deliberately - this
// runs on every predict call regardless of the calling user's role, so it can't be gated by
// the same role-based RLS insert policy predictions/cost_entries otherwise require.
async function insertAutoLlmCostEntry({ institutionId, amountUsd, note, relatedPredictionId, createdBy }) {
  if (!institutionId || !amountUsd) return null;
  const { data, error } = await supabaseAdmin
    .from(TABLES.COST_ENTRIES)
    .insert([{
      institution_id: institutionId,
      category: 'model',
      amount: amountUsd,
      source: 'auto_llm',
      note,
      related_prediction_id: relatedPredictionId || null,
      created_by: createdBy || null,
    }])
    .select()
    .single();
  if (error) {
    console.warn('Could not log auto LLM cost entry:', error.message);
    return null;
  }
  return data;
}

async function getLatestChatSession(client, institutionId, userId) {
  const { data, error } = await client
    .from(TABLES.CHAT_SESSIONS)
    .select('id, title, created_at')
    .eq('institution_id', institutionId)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load chat session: ${error.message}`);
  return data;
}

async function createChatSession(client, institutionId, userId, title) {
  const { data, error } = await client
    .from(TABLES.CHAT_SESSIONS)
    .insert([{ institution_id: institutionId, created_by: userId, title: title || null }])
    .select()
    .single();
  if (error) throw new Error(`Could not create chat session: ${error.message}`);
  return data;
}

async function listChatMessages(client, sessionId) {
  const { data, error } = await client
    .from(TABLES.CHAT_MESSAGES)
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load chat messages: ${error.message}`);
  return data;
}

async function insertChatMessage(client, message) {
  const { data, error } = await client.from(TABLES.CHAT_MESSAGES).insert([message]).select().single();
  if (error) throw new Error(`Could not save chat message: ${error.message}`);
  return data;
}

async function getSchoolStructure(client, institutionId) {
  const { data: departments, error: departmentError } = await client.from(TABLES.DEPARTMENTS).select('id, name').eq('institution_id', institutionId).order('name');
  if (departmentError) throw new Error(`Could not load departments: ${departmentError.message}`);
  const departmentIds = departments.map((department) => department.id);
  if (!departmentIds.length) return [];
  const { data: subjects, error: subjectError } = await client.from(TABLES.SUBJECTS).select('id, department_id, name, grade_level').in('department_id', departmentIds).order('name');
  if (subjectError) throw new Error(`Could not load subjects: ${subjectError.message}`);
  return departments.map((department) => ({ ...department, subjects: subjects.filter((subject) => subject.department_id === department.id) }));
}

async function importRosterRows(client, institutionId, rows) {
  const imported = [];
  for (const row of rows) {
    let subjectId = null;
    if (row.subject_name) {
      let departmentId = null;
      if (row.department_name) {
        const { data: department, error } = await client.from(TABLES.DEPARTMENTS).upsert({ institution_id: institutionId, name: row.department_name }, { onConflict: 'institution_id,name' }).select('id').single();
        if (error) throw new Error(`Could not save department: ${error.message}`);
        departmentId = department.id;
      }
      if (!departmentId) {
        const { data: department, error } = await client.from(TABLES.DEPARTMENTS).select('id').eq('institution_id', institutionId).limit(1).maybeSingle();
        if (error) throw new Error(`Could not find a department for subject: ${error.message}`);
        departmentId = department?.id;
      }
      if (!departmentId) throw new Error(`Row for ${row.full_name} names a subject but no department; add department_name.`);
      const { data: subject, error } = await client.from(TABLES.SUBJECTS).upsert({ department_id: departmentId, name: row.subject_name, grade_level: row.grade_level }, { onConflict: 'department_id,name,grade_level' }).select('id').single();
      if (error) throw new Error(`Could not save subject: ${error.message}`);
      subjectId = subject.id;
    }
    imported.push(await insertTeacher(client, { institution_id: institutionId, full_name: row.full_name, subject_id: subjectId, years_experience: row.years_experience, ai_tool_usage_frequency: row.ai_tool_usage_frequency, digital_skills_score: row.digital_skills_score, training_hours: row.training_hours, last_assessed_at: new Date().toISOString() }));
  }
  return imported;
}

async function insertReport(client, report) {
  const { data, error } = await client.from(TABLES.REPORTS).insert([report]).select().single();
  if (error) throw new Error(`Could not save report record: ${error.message}`);
  return data;
}

module.exports = {
  clientForToken,
  listTeachers,
  getTeacherById,
  insertTeacher,
  updateTeacher,
  insertPrediction,
  listPredictions,
  insertAutoLlmCostEntry,
  getLatestChatSession,
  createChatSession,
  listChatMessages,
  insertChatMessage,
  getSchoolStructure,
  importRosterRows,
  insertReport,
};
