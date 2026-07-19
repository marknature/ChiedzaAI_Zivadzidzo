const { createClient } = require('@supabase/supabase-js');
const { supabase: anonClient, supabaseAdmin, supabaseUrl, supabaseAnonKey } = require('../db');
const { TABLES, TASK_TYPES, AI_TOOL_USAGE_FREQUENCY_NUMERIC } = require('../config');

const MINISTRY_AGGREGATE_VIEW = 'ministry_aggregate_view';
const RECENT_ACTIVITY_WINDOW_DAYS = 30;
const TEACHER_RISK_BANDS = ['low', 'moderate', 'high', 'critical'];
const LEARNING_TRAJECTORY_BANDS = ['declining', 'at_risk', 'stable', 'improving'];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, decimals = 1) {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function latestItem(items) {
  return asArray(items).reduce((latest, item) => {
    if (!latest) return item;
    const candidateTime = timestamp(item?.created_at) ?? Number.NEGATIVE_INFINITY;
    const latestTime = timestamp(latest?.created_at) ?? Number.NEGATIVE_INFINITY;
    return candidateTime >= latestTime ? item : latest;
  }, null);
}

function average(values) {
  const valid = asArray(values).filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function publicInstitutionIdentity(institution) {
  return {
    id: institution?.id || null,
    name: institution?.name || null,
    district: institution?.district || null,
    schoolType: institution?.school_type || null,
  };
}

// This mirrors the documented teacher-readiness formula, but returns null when a
// roster record is incomplete instead of treating an unknown value as poor readiness.
function calculateTeacherDigitalReadiness(teacher) {
  const digitalSkills = numberOrNull(teacher?.digital_skills_score);
  const trainingHours = numberOrNull(teacher?.training_hours);
  const usageFrequency = teacher?.ai_tool_usage_frequency;
  const usageNumeric = AI_TOOL_USAGE_FREQUENCY_NUMERIC[usageFrequency];

  if (digitalSkills === null || trainingHours === null || usageNumeric === undefined) return null;

  const readiness =
    0.5 * clamp(digitalSkills, 0, 100) +
    0.3 * (usageNumeric * 20) +
    0.2 * Math.min(Math.max(trainingHours, 0) / 40, 1) * 100;
  return round(readiness);
}

function latestTeacherRolePredictions(predictions, teacherIds) {
  const byTeacherId = new Map();
  for (const prediction of asArray(predictions)) {
    if (prediction?.task_type !== TASK_TYPES.TEACHER_ROLES || !teacherIds.has(prediction.target_ref_id)) continue;
    const current = byTeacherId.get(prediction.target_ref_id);
    if (!current || (timestamp(prediction.created_at) ?? Number.NEGATIVE_INFINITY) >= (timestamp(current.created_at) ?? Number.NEGATIVE_INFINITY)) {
      byTeacherId.set(prediction.target_ref_id, prediction);
    }
  }
  return byTeacherId;
}

function teacherRoleRiskDistribution(latestPredictions, totalTeachers) {
  const distribution = Object.fromEntries(TEACHER_RISK_BANDS.map((band) => [band, 0]));
  for (const prediction of latestPredictions.values()) {
    const band = prediction?.prediction?.exposure_band;
    if (TEACHER_RISK_BANDS.includes(band)) distribution[band] += 1;
  }
  return {
    ...distribution,
    assessedTeachers: latestPredictions.size,
    unassessedTeachers: Math.max(totalTeachers - latestPredictions.size, 0),
  };
}

function isHighPriorityReskilling(prediction) {
  return ['high', 'urgent'].includes(prediction?.prediction?.reskilling_priority);
}

function latestCurriculumReadiness(predictions) {
  const latest = latestItem(asArray(predictions).filter((prediction) => prediction?.task_type === TASK_TYPES.CURRICULUM_SKILLS));
  if (!latest) {
    return {
      available: false,
      readinessScore: null,
      readinessBand: null,
      futureSkillsScore: null,
      confidence: null,
      assessedAt: null,
    };
  }

  const prediction = latest.prediction || {};
  return {
    available: true,
    readinessScore: round(numberOrNull(prediction.curriculum_readiness_score)),
    readinessBand: ['ai_ready', 'moderate_risk', 'high_obsolescence'].includes(prediction.readiness_band) ? prediction.readiness_band : null,
    futureSkillsScore: round(numberOrNull(prediction.future_skills_score)),
    confidence: round(numberOrNull(latest.confidence), 2),
    assessedAt: timestamp(latest.created_at) === null ? null : latest.created_at,
  };
}

function learningOutcomesTrend(predictions) {
  const outcomes = asArray(predictions).filter((prediction) => prediction?.task_type === TASK_TYPES.LEARNING_OUTCOMES);
  const trajectoryDistribution = Object.fromEntries(LEARNING_TRAJECTORY_BANDS.map((band) => [band, 0]));
  const scores = [];

  for (const outcome of outcomes) {
    const trajectory = outcome?.prediction?.trajectory_band;
    if (LEARNING_TRAJECTORY_BANDS.includes(trajectory)) trajectoryDistribution[trajectory] += 1;
    const score = numberOrNull(outcome?.prediction?.pass_rate_resilience_score);
    if (score !== null) scores.push(score);
  }

  const latest = latestItem(outcomes);
  return {
    assessmentCount: outcomes.length,
    averageResilienceScore: average(scores),
    trajectoryDistribution,
    atRiskCount: trajectoryDistribution.declining + trajectoryDistribution.at_risk,
    latestAssessedAt: timestamp(latest?.created_at) === null ? null : latest.created_at,
  };
}

function recentPredictionActivity(predictions, now = new Date()) {
  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
  const safeNow = Number.isFinite(nowTime) ? nowTime : Date.now();
  const cutoff = safeNow - RECENT_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = asArray(predictions).filter((prediction) => {
    const createdAt = timestamp(prediction?.created_at);
    return createdAt !== null
      && createdAt >= cutoff
      && createdAt <= safeNow
      && Object.values(TASK_TYPES).includes(prediction?.task_type);
  });
  const byTask = new Map();

  for (const prediction of recent) {
    if (!Object.values(TASK_TYPES).includes(prediction.task_type)) continue;
    const current = byTask.get(prediction.task_type) || { taskType: prediction.task_type, count: 0, latestAt: null };
    current.count += 1;
    if (!current.latestAt || (timestamp(prediction.created_at) ?? 0) >= (timestamp(current.latestAt) ?? 0)) {
      current.latestAt = prediction.created_at;
    }
    byTask.set(prediction.task_type, current);
  }

  return {
    windowDays: RECENT_ACTIVITY_WINDOW_DAYS,
    total: recent.length,
    byTask: Array.from(byTask.values()).sort((left, right) => (timestamp(right.latestAt) ?? 0) - (timestamp(left.latestAt) ?? 0)),
  };
}

function recentAggregatePredictionActivity(rows, now = new Date()) {
  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
  const safeNow = Number.isFinite(nowTime) ? nowTime : Date.now();
  const cutoff = safeNow - RECENT_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const byTask = new Map();

  for (const row of asArray(rows)) {
    const createdAt = timestamp(row?.month);
    if (createdAt === null || createdAt < cutoff || createdAt > safeNow || !Object.values(TASK_TYPES).includes(row?.task_type)) continue;
    const count = Math.max(Math.floor(numberOrNull(row.n_predictions) || 0), 0);
    const current = byTask.get(row.task_type) || { taskType: row.task_type, count: 0, latestAt: null };
    current.count += count;
    if (!current.latestAt || createdAt >= (timestamp(current.latestAt) ?? Number.NEGATIVE_INFINITY)) current.latestAt = row.month;
    byTask.set(row.task_type, current);
  }

  const byTaskRows = Array.from(byTask.values()).sort((left, right) => (timestamp(right.latestAt) ?? 0) - (timestamp(left.latestAt) ?? 0));
  return {
    windowDays: RECENT_ACTIVITY_WINDOW_DAYS,
    total: byTaskRows.reduce((sum, task) => sum + task.count, 0),
    byTask: byTaskRows,
  };
}

function buildPriorityAlerts({ totalTeachers, assessedTeachers, highPriorityReskillingCount, urgentReskillingCount, curriculumRiskCount, learningTrend }) {
  const alerts = [];
  if (urgentReskillingCount > 0 || highPriorityReskillingCount > 0) {
    alerts.push({
      type: 'teacher_reskilling',
      severity: urgentReskillingCount > 0 ? 'critical' : 'high',
      count: highPriorityReskillingCount,
      title: 'Reskilling support needed',
      message: `${highPriorityReskillingCount} teacher assessment${highPriorityReskillingCount === 1 ? '' : 's'} ${highPriorityReskillingCount === 1 ? 'needs' : 'need'} high-priority reskilling support.`,
    });
  }
  if (curriculumRiskCount > 0) {
    alerts.push({
      type: 'curriculum_risk',
      severity: 'high',
      count: curriculumRiskCount,
      title: 'Curriculum readiness needs attention',
      message: `${curriculumRiskCount} curriculum assessment${curriculumRiskCount === 1 ? '' : 's'} ${curriculumRiskCount === 1 ? 'is' : 'are'} flagged as high obsolescence risk.`,
    });
  }
  if (learningTrend.atRiskCount > 0) {
    alerts.push({
      type: 'learning_outcomes',
      severity: learningTrend.trajectoryDistribution.declining > 0 ? 'high' : 'medium',
      count: learningTrend.atRiskCount,
      title: 'Learning outcomes need review',
      message: `${learningTrend.atRiskCount} cohort assessment${learningTrend.atRiskCount === 1 ? '' : 's'} ${learningTrend.atRiskCount === 1 ? 'is' : 'are'} declining or at risk.`,
    });
  }
  if (totalTeachers > assessedTeachers) {
    alerts.push({
      type: 'assessment_coverage',
      severity: 'medium',
      count: totalTeachers - assessedTeachers,
      title: 'Staff assessment coverage is incomplete',
      message: `${totalTeachers - assessedTeachers} rostered teacher${totalTeachers - assessedTeachers === 1 ? '' : 's'} ${totalTeachers - assessedTeachers === 1 ? 'has' : 'have'} no recorded assessment date.`,
    });
  }
  return alerts;
}

// Deliberately maps raw rows to a presentation-safe aggregate contract. Do not add
// names, IDs, raw input_features, or per-person prediction results to this response.
function buildSchoolOverview({ institution, teachers, predictions, now }) {
  const safeTeachers = asArray(teachers);
  const safePredictions = asArray(predictions);
  const teacherIds = new Set(safeTeachers.map((teacher) => teacher?.id).filter(Boolean));
  const latestRolePredictions = latestTeacherRolePredictions(safePredictions, teacherIds);
  const assessedTeacherIds = new Set(
    safeTeachers
      .filter((teacher) => timestamp(teacher?.last_assessed_at) !== null)
      .map((teacher) => teacher.id),
  );
  for (const teacherId of latestRolePredictions.keys()) assessedTeacherIds.add(teacherId);

  const totalTeachers = safeTeachers.length;
  const assessedTeachers = assessedTeacherIds.size;
  const highPriorityReskillingCount = Array.from(latestRolePredictions.values()).filter(isHighPriorityReskilling).length;
  const urgentReskillingCount = Array.from(latestRolePredictions.values())
    .filter((prediction) => prediction?.prediction?.reskilling_priority === 'urgent').length;
  const curriculumRiskCount = safePredictions.filter((prediction) => (
    prediction?.task_type === TASK_TYPES.CURRICULUM_SKILLS
    && prediction?.prediction?.readiness_band === 'high_obsolescence'
  )).length;
  const learningTrend = learningOutcomesTrend(safePredictions);
  const activity = recentPredictionActivity(safePredictions, now);

  return {
    dataScope: 'institution_aggregate',
    institution: publicInstitutionIdentity(institution),
    schoolReadiness: {
      totalTeachers,
      assessedTeachers,
      averageDigitalReadiness: average(safeTeachers.map(calculateTeacherDigitalReadiness)),
      highPriorityReskillingCount,
      curriculumRiskCount,
      recentActivityCount: activity.total,
      assessmentCoveragePercent: totalTeachers ? round((assessedTeachers / totalTeachers) * 100) : null,
    },
    priorityAlerts: buildPriorityAlerts({
      totalTeachers,
      assessedTeachers,
      highPriorityReskillingCount,
      urgentReskillingCount,
      curriculumRiskCount,
      learningTrend,
    }),
    teacherRoleRiskDistribution: teacherRoleRiskDistribution(latestRolePredictions, totalTeachers),
    latestCurriculumReadiness: latestCurriculumReadiness(safePredictions),
    learningOutcomesTrend: learningTrend,
    recentPredictionActivity: activity,
  };
}

function buildMinistrySchoolOverview({ institution, aggregateRows, now }) {
  const rows = asArray(aggregateRows).filter((row) => Object.values(TASK_TYPES).includes(row?.task_type));
  const taskSummary = (taskType) => {
    const taskRows = rows.filter((row) => row.task_type === taskType);
    const assessmentCount = taskRows.reduce((sum, row) => sum + Math.max(numberOrNull(row.n_predictions) || 0, 0), 0);
    const confidenceTotal = taskRows.reduce((sum, row) => sum + ((numberOrNull(row.avg_confidence) || 0) * Math.max(numberOrNull(row.n_predictions) || 0, 0)), 0);
    const latest = latestItem(taskRows.map((row) => ({ created_at: row.month })));
    return {
      assessmentCount,
      averageConfidence: assessmentCount ? round(confidenceTotal / assessmentCount, 2) : null,
      latestMonth: timestamp(latest?.created_at) === null ? null : latest.created_at,
    };
  };

  const taskSummaries = Object.fromEntries(Object.values(TASK_TYPES).map((taskType) => [taskType, taskSummary(taskType)]));
  const activity = recentAggregatePredictionActivity(rows, now);

  return {
    dataScope: 'institution_aggregate_only',
    institution: publicInstitutionIdentity(institution),
    schoolReadiness: {
      totalTeachers: null,
      assessedTeachers: null,
      averageDigitalReadiness: null,
      highPriorityReskillingCount: null,
      curriculumRiskCount: null,
      recentActivityCount: activity.total,
      assessmentCoveragePercent: null,
    },
    priorityAlerts: [],
    teacherRoleRiskDistribution: {
      low: null,
      moderate: null,
      high: null,
      critical: null,
      assessedTeachers: null,
      unassessedTeachers: null,
    },
    latestCurriculumReadiness: {
      available: taskSummaries[TASK_TYPES.CURRICULUM_SKILLS].assessmentCount > 0,
      ...taskSummaries[TASK_TYPES.CURRICULUM_SKILLS],
    },
    learningOutcomesTrend: {
      ...taskSummaries[TASK_TYPES.LEARNING_OUTCOMES],
      averageResilienceScore: null,
      trajectoryDistribution: null,
      atRiskCount: null,
    },
    recentPredictionActivity: activity,
  };
}

function buildSchoolStructure({ departments, subjects, teachers, predictions }) {
  const safeDepartments = asArray(departments);
  const safeSubjects = asArray(subjects);
  const safeTeachers = asArray(teachers);
  const teacherIds = new Set(safeTeachers.map((teacher) => teacher?.id).filter(Boolean));
  const latestRolePredictions = latestTeacherRolePredictions(predictions, teacherIds);
  const subjectsByDepartment = new Map();

  for (const subject of safeSubjects) {
    if (!subjectsByDepartment.has(subject?.department_id)) subjectsByDepartment.set(subject?.department_id, []);
    subjectsByDepartment.get(subject?.department_id).push(subject);
  }

  const departmentsWithMetrics = safeDepartments.map((department) => {
    const departmentSubjects = subjectsByDepartment.get(department.id) || [];
    const subjectIds = new Set(departmentSubjects.map((subject) => subject.id));
    const departmentTeachers = safeTeachers.filter((teacher) => subjectIds.has(teacher?.subject_id));
    const departmentTeacherIds = new Set(departmentTeachers.map((teacher) => teacher.id));
    const departmentRoles = new Map(Array.from(latestRolePredictions.entries()).filter(([teacherId]) => departmentTeacherIds.has(teacherId)));
    const assessedStaffCount = departmentTeachers.filter((teacher) => timestamp(teacher?.last_assessed_at) !== null || departmentRoles.has(teacher.id)).length;

    return {
      id: department.id,
      name: department.name,
      subjects: departmentSubjects.map((subject) => ({ id: subject.id, name: subject.name, grade_level: subject.grade_level || null })),
      metrics: {
        subjectCount: departmentSubjects.length,
        staffCount: departmentTeachers.length,
        assessedStaffCount,
        averageDigitalReadiness: average(departmentTeachers.map(calculateTeacherDigitalReadiness)),
        highPriorityReskillingCount: Array.from(departmentRoles.values()).filter(isHighPriorityReskilling).length,
        teacherRoleRiskDistribution: teacherRoleRiskDistribution(departmentRoles, departmentTeachers.length),
      },
    };
  });

  const validSubjectIds = new Set(safeSubjects.map((subject) => subject?.id).filter(Boolean));
  const assignedTeachers = safeTeachers.filter((teacher) => teacher?.subject_id && validSubjectIds.has(teacher.subject_id));
  const assessedTeacherIds = new Set(safeTeachers.filter((teacher) => timestamp(teacher?.last_assessed_at) !== null).map((teacher) => teacher.id));
  for (const teacherId of latestRolePredictions.keys()) assessedTeacherIds.add(teacherId);

  return {
    departments: departmentsWithMetrics,
    staffSummary: {
      totalTeachers: safeTeachers.length,
      assignedTeachers: assignedTeachers.length,
      unassignedTeachers: safeTeachers.length - assignedTeachers.length,
      assessedTeachers: assessedTeacherIds.size,
      averageDigitalReadiness: average(safeTeachers.map(calculateTeacherDigitalReadiness)),
      highPriorityReskillingCount: Array.from(latestRolePredictions.values()).filter(isHighPriorityReskilling).length,
    },
  };
}

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

async function getChatSession(client, sessionId, institutionId, createdBy) {
  let query = client.from(TABLES.CHAT_SESSIONS).select('id, institution_id, created_by, title, created_at').eq('id', sessionId).eq('institution_id', institutionId);
  if (createdBy) query = query.eq('created_by', createdBy);
  const { data, error } = await query.maybeSingle();
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

async function getSchoolOverview(client, institutionId, { isMinistryViewer = false } = {}) {
  const { data: institution, error: institutionError } = await client
    .from(TABLES.INSTITUTIONS)
    .select('id, name, district, school_type')
    .eq('id', institutionId)
    .maybeSingle();
  if (institutionError) throw new Error(`Could not load institution: ${institutionError.message}`);
  if (!institution) {
    const error = new Error('Institution not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Ministry viewers are denied direct access to roster and prediction rows by RLS.
  // Read only the security-definer aggregate view so this route cannot accidentally
  // turn into a path around that protection.
  if (isMinistryViewer) {
    const { data: aggregateRows, error: aggregateError } = await client
      .from(MINISTRY_AGGREGATE_VIEW)
      .select('institution_id, task_type, avg_confidence, n_predictions, month')
      .eq('institution_id', institutionId);
    if (aggregateError) throw new Error(`Could not load ministry aggregate overview: ${aggregateError.message}`);
    return buildMinistrySchoolOverview({ institution, aggregateRows });
  }

  const [teacherResult, predictionResult] = await Promise.all([
    client
      .from(TABLES.TEACHERS)
      .select('id, subject_id, digital_skills_score, training_hours, ai_tool_usage_frequency, last_assessed_at')
      .eq('institution_id', institutionId),
    client
      .from(TABLES.PREDICTIONS)
      .select('task_type, target_ref_id, prediction, confidence, created_at')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false }),
  ]);
  if (teacherResult.error) throw new Error(`Could not load roster aggregates: ${teacherResult.error.message}`);
  if (predictionResult.error) throw new Error(`Could not load prediction aggregates: ${predictionResult.error.message}`);

  return buildSchoolOverview({ institution, teachers: teacherResult.data, predictions: predictionResult.data });
}

async function getSchoolStructure(client, institutionId, { isMinistryViewer = false } = {}) {
  // RLS deliberately hides department/subject/roster rows from ministry viewers.
  // Return an explicit empty aggregate shell rather than attempting to read raw rows.
  if (isMinistryViewer) {
    return {
      departments: [],
      staffSummary: {
        totalTeachers: null,
        assignedTeachers: null,
        unassignedTeachers: null,
        assessedTeachers: null,
        averageDigitalReadiness: null,
        highPriorityReskillingCount: null,
      },
    };
  }

  const { data: departments, error: departmentError } = await client
    .from(TABLES.DEPARTMENTS)
    .select('id, name')
    .eq('institution_id', institutionId)
    .order('name');
  if (departmentError) throw new Error(`Could not load departments: ${departmentError.message}`);

  const departmentIds = asArray(departments).map((department) => department.id);
  const subjectResult = departmentIds.length
    ? await client.from(TABLES.SUBJECTS).select('id, department_id, name, grade_level').in('department_id', departmentIds).order('name')
    : { data: [], error: null };
  if (subjectResult.error) throw new Error(`Could not load subjects: ${subjectResult.error.message}`);

  const [teacherResult, predictionResult] = await Promise.all([
    client
      .from(TABLES.TEACHERS)
      .select('id, subject_id, digital_skills_score, training_hours, ai_tool_usage_frequency, last_assessed_at')
      .eq('institution_id', institutionId),
    client
      .from(TABLES.PREDICTIONS)
      .select('task_type, target_ref_id, prediction, created_at')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false }),
  ]);
  if (teacherResult.error) throw new Error(`Could not load roster aggregates: ${teacherResult.error.message}`);
  if (predictionResult.error) throw new Error(`Could not load prediction aggregates: ${predictionResult.error.message}`);

  return buildSchoolStructure({
    departments,
    subjects: subjectResult.data,
    teachers: teacherResult.data,
    predictions: predictionResult.data,
  });
}

async function importRosterRows(client, institutionId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Roster import requires at least one validated row.');
  }
  const { data, error } = await client.rpc('import_roster_rows', {
    p_institution_id: institutionId,
    p_rows: rows,
  });
  if (error) {
    throw new Error(`Could not import roster atomically: ${error.message}`);
  }
  return data || [];
}

async function insertReport(client, report) {
  const { data, error } = await client.from(TABLES.REPORTS).insert([report]).select().single();
  if (error) throw new Error(`Could not save report record: ${error.message}`);
  return data;
}

async function listReports(client, institutionId) {
  const { data, error } = await client.from(TABLES.REPORTS).select('*').eq('institution_id', institutionId).order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return data;
}

async function upsertPushToken(client, { institutionId, profileId, expoPushToken }) {
  const { data, error } = await client.from(TABLES.PUSH_TOKENS).upsert({ institution_id: institutionId, profile_id: profileId, expo_push_token: expoPushToken }, { onConflict: 'expo_push_token' }).select().single();
  if (error) throw new Error(`Could not save device notification token: ${error.message}`);
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
  getChatSession,
  createChatSession,
  listChatMessages,
  insertChatMessage,
  getSchoolOverview,
  getSchoolStructure,
  importRosterRows,
  insertReport,
  listReports,
  upsertPushToken,
  // Pure aggregate mappers are exported for unit tests and must remain free of
  // direct database access so their privacy contract is easy to verify.
  calculateTeacherDigitalReadiness,
  buildSchoolOverview,
  buildMinistrySchoolOverview,
  buildSchoolStructure,
};
