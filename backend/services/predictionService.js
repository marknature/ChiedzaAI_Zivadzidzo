const supabaseService = require('./supabaseService');
const { runStructuredPrediction } = require('./openaiService');
const { teacherRolesSchema, teacherRolesZod, teacherRolesSystemPrompt } = require('../schemas/teacherRoles');
const { learningOutcomesSchema, learningOutcomesZod, learningOutcomesSystemPrompt } = require('../schemas/learningOutcomes');
const { runCurriculumSkillsPrediction: runCurriculumSkillsLLM } = require('./curriculumService');
const { TASK_TYPES, AI_TOOL_USAGE_FREQUENCY_NUMERIC, modelVersionTag } = require('../config');
const { notifyPriorityPrediction } = require('./notificationService');

// Shared by the HTTP predict routes AND the chat assistant's tool-calls, so both paths
// produce identical persisted rows/cost entries - one implementation of each predict head,
// not two that can drift apart.

const STUDENT_IDENTIFIER_FIELDS = new Set(['studentid', 'studentname', 'student_id', 'student_name', 'learnerid', 'learnername', 'student_number', 'learner_number', 'national_id']);

function findStudentIdentifierFields(value, path = '$') {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findStudentIdentifierFields(item, `${path}[${index}]`));
  return Object.entries(value).flatMap(([key, nested]) => [
    ...(STUDENT_IDENTIFIER_FIELDS.has(key.toLowerCase()) ? [`${path}.${key}`] : []),
    ...findStudentIdentifierFields(nested, `${path}.${key}`),
  ]);
}

function computeTeacherRolesEngineeredFeatures(teacher) {
  const yearsExperience = Math.max(Number(teacher.years_experience) || 0, 1);
  const trainingHours = Number(teacher.training_hours) || 0;
  const digitalSkillsScore = Number(teacher.digital_skills_score) || 0;
  const usageFrequencyNumeric = AI_TOOL_USAGE_FREQUENCY_NUMERIC[teacher.ai_tool_usage_frequency] ?? 0;

  const trainingHoursPerYearOfService = trainingHours / yearsExperience;
  const digitalReadinessIndex =
    0.5 * digitalSkillsScore +
    0.3 * (usageFrequencyNumeric * 20) +
    0.2 * Math.min(trainingHours / 40, 1) * 100;

  return {
    training_hours_per_year_of_service: Number(trainingHoursPerYearOfService.toFixed(2)),
    digital_readiness_index: Number(digitalReadinessIndex.toFixed(2)),
  };
}

function computeLearningOutcomesEngineeredFeatures(historicalPassRates) {
  if (!Array.isArray(historicalPassRates) || historicalPassRates.length === 0) {
    return { pass_rate_trend_per_period: 0, latest_pass_rate: null, periods_of_history: 0 };
  }
  const first = historicalPassRates[0].passRatePercent;
  const last = historicalPassRates[historicalPassRates.length - 1].passRatePercent;
  const spans = Math.max(historicalPassRates.length - 1, 1);
  return {
    pass_rate_trend_per_period: Number(((last - first) / spans).toFixed(2)),
    latest_pass_rate: last,
    periods_of_history: historicalPassRates.length,
  };
}

async function predictTeacherRoles({ client, profile, teacherId }) {
  if (!teacherId) {
    const error = new Error('teacherId is required.');
    error.code = 'VALIDATION';
    throw error;
  }
  const teacher = await supabaseService.getTeacherById(client, teacherId);
  if (!teacher || teacher.institution_id !== profile.institution_id) {
    const error = new Error('Teacher not found.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const engineeredFeatures = computeTeacherRolesEngineeredFeatures(teacher);
  const rawFeatures = {
    full_name: teacher.full_name,
    years_experience: teacher.years_experience,
    ai_tool_usage_frequency: teacher.ai_tool_usage_frequency,
    digital_skills_score: teacher.digital_skills_score,
    training_hours: teacher.training_hours,
  };

  const userContent = `Teacher: ${teacher.full_name}\n` +
    `Years of teaching experience: ${teacher.years_experience ?? 'unknown'}\n` +
    `Self/admin-rated digital skills score (0-100): ${teacher.digital_skills_score ?? 'unknown'}\n` +
    `AI tool usage frequency: ${teacher.ai_tool_usage_frequency ?? 'unknown'}\n` +
    `Training hours in the last 12 months: ${teacher.training_hours ?? 'unknown'}\n` +
    `Engineered feature - training hours per year of service: ${engineeredFeatures.training_hours_per_year_of_service}\n` +
    `Engineered feature - digital readiness index (0-100): ${engineeredFeatures.digital_readiness_index}\n\n` +
    `Assess this teacher's AI-disruption exposure and reskilling priority.`;

  const { result, modelUsed, costUsd } = await runStructuredPrediction({
    schema: teacherRolesSchema,
    zodSchema: teacherRolesZod,
    systemPrompt: teacherRolesSystemPrompt,
    userContent,
  });

  const predictionRow = await supabaseService.insertPrediction(client, {
    institution_id: profile.institution_id,
    task_type: TASK_TYPES.TEACHER_ROLES,
    target_ref_id: teacherId,
    input_features: { raw: rawFeatures, engineered: engineeredFeatures },
    prediction: {
      ai_disruption_exposure_score: result.ai_disruption_exposure_score,
      exposure_band: result.exposure_band,
      reskilling_priority: result.reskilling_priority,
      recommended_actions: result.recommended_actions,
    },
    rationale: { contributing_factors: result.contributing_factors, caveats: result.caveats },
    confidence: result.confidence,
    model_version: modelVersionTag(TASK_TYPES.TEACHER_ROLES),
    created_by: profile.id,
  });

  await supabaseService.insertAutoLlmCostEntry({
    institutionId: profile.institution_id,
    amountUsd: costUsd,
    note: `Teacher Roles prediction for ${teacher.full_name} (${modelUsed})`,
    relatedPredictionId: predictionRow.id,
    createdBy: profile.id,
  });
  try { await notifyPriorityPrediction({ institutionId: profile.institution_id, prediction: predictionRow }); } catch (error) { console.warn('Priority notification was not sent:', error.message); }

  return predictionRow;
}

async function predictLearningOutcomes({ client, profile, subjectName, gradeLevel, historicalPassRates, aiToolExposureLevel, cohortSize, rawBody }) {
  const presentIdentifierFields = findStudentIdentifierFields(rawBody || {});
  if (presentIdentifierFields.length > 0) {
    const error = new Error(`The learning-outcomes head only accepts cohort/subject-level aggregates, never individual student identifiers. Remove: ${presentIdentifierFields.join(', ')}.`);
    error.code = 'VALIDATION';
    throw error;
  }
  if (!subjectName || typeof subjectName !== 'string') {
    const error = new Error('subjectName is required.');
    error.code = 'VALIDATION';
    throw error;
  }
  if (!Array.isArray(historicalPassRates) || historicalPassRates.length === 0) {
    const error = new Error('historicalPassRates must be a non-empty array of { period, passRatePercent }.');
    error.code = 'VALIDATION';
    throw error;
  }
  if (historicalPassRates.some((point) => !point || typeof point.period !== 'string' || typeof point.passRatePercent !== 'number' || point.passRatePercent < 0 || point.passRatePercent > 100)) {
    const error = new Error('Each historicalPassRates item must contain a period string and passRatePercent between 0 and 100.');
    error.code = 'VALIDATION';
    throw error;
  }
  if (typeof aiToolExposureLevel !== 'number' || aiToolExposureLevel < 0 || aiToolExposureLevel > 100) {
    const error = new Error('aiToolExposureLevel must be a number between 0 and 100.');
    error.code = 'VALIDATION';
    throw error;
  }
  if (cohortSize !== undefined && (!Number.isInteger(cohortSize) || cohortSize < 1)) {
    const error = new Error('cohortSize must be a positive whole number when provided.');
    error.code = 'VALIDATION';
    throw error;
  }

  const engineeredFeatures = computeLearningOutcomesEngineeredFeatures(historicalPassRates);
  const historyLines = historicalPassRates.map((p) => `  - ${p.period}: ${p.passRatePercent}%`).join('\n');
  const userContent = `Subject: ${subjectName}\n` +
    `Grade level: ${gradeLevel || 'unspecified'}\n` +
    `Cohort size: ${cohortSize ?? 'unspecified'}\n` +
    `AI tool exposure level in this subject/grade (0-100): ${aiToolExposureLevel}\n` +
    `Historical pass rates:\n${historyLines}\n` +
    `Engineered feature - pass rate trend per period (percentage points): ${engineeredFeatures.pass_rate_trend_per_period}\n` +
    `Engineered feature - periods of history available: ${engineeredFeatures.periods_of_history}\n\n` +
    `Assess this cohort's pass-rate trajectory resilience as AI-tool exposure rises. Remember: this is a subject/grade ` +
    `cohort, not an individual student.`;

  const { result, modelUsed, costUsd } = await runStructuredPrediction({
    schema: learningOutcomesSchema,
    zodSchema: learningOutcomesZod,
    systemPrompt: learningOutcomesSystemPrompt,
    userContent,
  });

  const predictionRow = await supabaseService.insertPrediction(client, {
    institution_id: profile.institution_id,
    task_type: TASK_TYPES.LEARNING_OUTCOMES,
    target_ref_id: null,
    input_features: { raw: { subjectName, gradeLevel: gradeLevel || null, historicalPassRates, aiToolExposureLevel, cohortSize: cohortSize ?? null }, engineered: engineeredFeatures },
    prediction: {
      pass_rate_resilience_score: result.pass_rate_resilience_score,
      trajectory_band: result.trajectory_band,
      recommended_actions: result.recommended_actions,
    },
    rationale: { contributing_factors: result.contributing_factors, caveats: result.caveats },
    confidence: result.confidence,
    model_version: modelVersionTag(TASK_TYPES.LEARNING_OUTCOMES),
    created_by: profile.id,
  });

  await supabaseService.insertAutoLlmCostEntry({
    institutionId: profile.institution_id,
    amountUsd: costUsd,
    note: `Learning Outcomes prediction for ${subjectName} (${modelUsed})`,
    relatedPredictionId: predictionRow.id,
    createdBy: profile.id,
  });
  try { await notifyPriorityPrediction({ institutionId: profile.institution_id, prediction: predictionRow }); } catch (error) { console.warn('Priority notification was not sent:', error.message); }

  return predictionRow;
}

async function predictCurriculumSkills({ client, profile, title = 'Untitled curriculum', gradeLevel, syllabusText, alpha = 0.8 }) {
  if (typeof syllabusText !== 'string' || syllabusText.trim().length < 12) {
    const error = new Error('Please provide at least a short syllabus or course outline.');
    error.code = 'VALIDATION';
    throw error;
  }

  const result = await runCurriculumSkillsLLM({ title, gradeLevel, syllabusText: syllabusText.trim(), alpha });

  const predictionRow = await supabaseService.insertPrediction(client, {
    institution_id: profile.institution_id,
    task_type: TASK_TYPES.CURRICULUM_SKILLS,
    target_ref_id: null,
    input_features: { raw: { title, gradeLevel: gradeLevel || null, syllabusText: syllabusText.trim(), alpha } },
    prediction: {
      curriculum_readiness_score: result.curriculum_readiness_score,
      readiness_band: result.readiness_band,
      recommended_actions: result.recommended_actions,
      future_skills_score: result.future_skills_score,
      summary: result.summary,
      subjects: result.subjects,
    },
    rationale: { contributing_factors: result.contributing_factors, caveats: result.caveats },
    confidence: result.confidence,
    model_version: modelVersionTag(TASK_TYPES.CURRICULUM_SKILLS),
    created_by: profile.id,
  });

  await supabaseService.insertAutoLlmCostEntry({
    institutionId: profile.institution_id,
    amountUsd: result.costUsd,
    note: `Curriculum Skills prediction for "${title}" (${result.modelUsed})`,
    relatedPredictionId: predictionRow.id,
    createdBy: profile.id,
  });
  try { await notifyPriorityPrediction({ institutionId: profile.institution_id, prediction: predictionRow }); } catch (error) { console.warn('Priority notification was not sent:', error.message); }

  return predictionRow;
}

module.exports = {
  predictTeacherRoles,
  predictLearningOutcomes,
  predictCurriculumSkills,
  computeTeacherRolesEngineeredFeatures,
  computeLearningOutcomesEngineeredFeatures,
  findStudentIdentifierFields,
};
