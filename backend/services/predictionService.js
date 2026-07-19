const supabaseService = require('./supabaseService');
const { runStructuredPrediction } = require('./openaiService');
const { teacherRolesSchema, teacherRolesZod, teacherRolesSystemPrompt } = require('../schemas/teacherRoles');
const { learningOutcomesSchema, learningOutcomesZod, learningOutcomesSystemPrompt } = require('../schemas/learningOutcomes');
const { runCurriculumSkillsPrediction: runCurriculumSkillsLLM, validateCurriculumSkillsInput } = require('./curriculumService');
const { TASK_TYPES, TABLES, AI_TOOL_USAGE_FREQUENCY_NUMERIC, modelVersionTag } = require('../config');
const { notifyPriorityPrediction } = require('./notificationService');
const { findLearnerIdentifierFields, rejectLearnerIdentifiers } = require('./privacyService');

// Shared by the HTTP predict routes AND the chat assistant's tool-calls, so both paths
// produce identical persisted rows/cost entries - one implementation of each predict head,
// not two that can drift apart.

const LEARNING_OUTCOMES_FIELDS = new Set([
  'subjectName', 'gradeLevel', 'historicalPassRates', 'aiToolExposureLevel',
  'cohortSize', 'curriculumDeliveryContext',
]);

function validationError(message) {
  const error = new Error(message);
  error.code = 'VALIDATION';
  return error;
}

function validateLearningOutcomesInput(rawBody) {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw validationError('Learning Outcomes input must be an object of cohort-level aggregate fields.');
  }
  rejectLearnerIdentifiers(rawBody);

  const unexpectedFields = Object.keys(rawBody).filter((key) => !LEARNING_OUTCOMES_FIELDS.has(key));
  if (unexpectedFields.length) {
    throw validationError(`Learning Outcomes accepts cohort aggregates only. Remove unsupported fields: ${unexpectedFields.join(', ')}.`);
  }

  const { subjectName, gradeLevel, historicalPassRates, aiToolExposureLevel, cohortSize, curriculumDeliveryContext } = rawBody;
  if (!subjectName || typeof subjectName !== 'string') throw validationError('subjectName is required.');
  if (subjectName.trim().length > 120) throw validationError('subjectName must be 120 characters or fewer.');
  if (gradeLevel !== undefined && (typeof gradeLevel !== 'string' || !gradeLevel.trim() || gradeLevel.trim().length > 120)) throw validationError('gradeLevel must be a non-empty string of 120 characters or fewer when provided.');
  if (!Array.isArray(historicalPassRates) || historicalPassRates.length === 0 || historicalPassRates.length > 12) {
    throw validationError('historicalPassRates must contain between 1 and 12 aggregate { period, passRatePercent } values.');
  }
  const invalidPeriod = historicalPassRates.find((point) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) return true;
    const keys = Object.keys(point);
    return keys.length !== 2 || !keys.includes('period') || !keys.includes('passRatePercent')
      || typeof point.period !== 'string' || !point.period.trim() || point.period.trim().length > 80
      || typeof point.passRatePercent !== 'number' || point.passRatePercent < 0 || point.passRatePercent > 100;
  });
  if (invalidPeriod) throw validationError('Each historicalPassRates item must contain only a period string and passRatePercent between 0 and 100.');
  if (typeof aiToolExposureLevel !== 'number' || aiToolExposureLevel < 0 || aiToolExposureLevel > 100) {
    throw validationError('aiToolExposureLevel must be a number between 0 and 100.');
  }
  if (cohortSize !== undefined && (!Number.isInteger(cohortSize) || cohortSize < 1)) {
    throw validationError('cohortSize must be a positive whole number when provided.');
  }
  if (curriculumDeliveryContext !== undefined && (typeof curriculumDeliveryContext !== 'string' || !curriculumDeliveryContext.trim() || curriculumDeliveryContext.trim().length > 1000)) {
    throw validationError('curriculumDeliveryContext must be a non-empty string of 1,000 characters or fewer when provided.');
  }

  return { subjectName: subjectName.trim(), gradeLevel: gradeLevel?.trim() || null, historicalPassRates, aiToolExposureLevel, cohortSize: cohortSize ?? null, curriculumDeliveryContext: curriculumDeliveryContext?.trim() || null };
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

function formatAssessmentDate(value) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not recorded' : parsed.toISOString().slice(0, 10);
}

function buildTeacherRolesUserContent({ teacher, subjectName = 'Not recorded' }) {
  const engineeredFeatures = computeTeacherRolesEngineeredFeatures(teacher);
  return `Teacher role profile\n` +
    `Subject: ${subjectName || 'Not recorded'}\n` +
    `Last assessment date: ${formatAssessmentDate(teacher.last_assessed_at)}\n` +
    `Years of teaching experience: ${teacher.years_experience ?? 'unknown'}\n` +
    `Self/admin-rated digital skills score (0-100): ${teacher.digital_skills_score ?? 'unknown'}\n` +
    `AI tool usage frequency: ${teacher.ai_tool_usage_frequency ?? 'unknown'}\n` +
    `Training hours in the last 12 months: ${teacher.training_hours ?? 'unknown'}\n` +
    `Engineered feature - training hours per year of service: ${engineeredFeatures.training_hours_per_year_of_service}\n` +
    `Engineered feature - digital readiness index (0-100): ${engineeredFeatures.digital_readiness_index}\n\n` +
    `Assess this teacher role's AI-disruption exposure and reskilling priority.`;
}

async function subjectNameForTeacher(client, subjectId) {
  if (!subjectId) return 'Not recorded';
  const { data, error } = await client
    .from(TABLES.SUBJECTS)
    .select('name')
    .eq('id', subjectId)
    .maybeSingle();
  if (error) {
    console.warn('Could not load subject for Teacher Roles assessment:', error.message);
    return 'Not recorded';
  }
  return data?.name || 'Not recorded';
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

  const subjectName = await subjectNameForTeacher(client, teacher.subject_id);
  const engineeredFeatures = computeTeacherRolesEngineeredFeatures(teacher);
  const rawFeatures = {
    subject_name: subjectName,
    last_assessed_at: teacher.last_assessed_at || null,
    years_experience: teacher.years_experience,
    ai_tool_usage_frequency: teacher.ai_tool_usage_frequency,
    digital_skills_score: teacher.digital_skills_score,
    training_hours: teacher.training_hours,
  };
  const userContent = buildTeacherRolesUserContent({ teacher, subjectName });

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

async function predictLearningOutcomes({ client, profile, rawBody }) {
  const { subjectName, gradeLevel, historicalPassRates, aiToolExposureLevel, cohortSize, curriculumDeliveryContext } = validateLearningOutcomesInput(rawBody);

  const engineeredFeatures = computeLearningOutcomesEngineeredFeatures(historicalPassRates);
  const historyLines = historicalPassRates.map((p) => `  - ${p.period}: ${p.passRatePercent}%`).join('\n');
  const userContent = `Subject: ${subjectName}\n` +
    `Grade level: ${gradeLevel || 'unspecified'}\n` +
    `Cohort size: ${cohortSize ?? 'unspecified'}\n` +
    `AI tool exposure level in this subject/grade (0-100): ${aiToolExposureLevel}\n` +
    `Curriculum delivery context: ${curriculumDeliveryContext || 'unspecified'}\n` +
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
    input_features: { raw: { subjectName, gradeLevel, historicalPassRates, aiToolExposureLevel, cohortSize, curriculumDeliveryContext }, engineered: engineeredFeatures },
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

async function predictCurriculumSkills({ client, profile, title, gradeLevel, syllabusText, alpha, subjectTopicBreakdown }) {
  const normalizedInput = validateCurriculumSkillsInput({ title, gradeLevel, syllabusText, alpha, subjectTopicBreakdown });
  const result = await runCurriculumSkillsLLM(normalizedInput);

  const predictionRow = await supabaseService.insertPrediction(client, {
    institution_id: profile.institution_id,
    task_type: TASK_TYPES.CURRICULUM_SKILLS,
    target_ref_id: null,
    input_features: { raw: normalizedInput },
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
    note: `Curriculum Skills prediction for "${normalizedInput.title}" (${result.modelUsed})`,
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
  buildTeacherRolesUserContent,
  formatAssessmentDate,
  findStudentIdentifierFields: findLearnerIdentifierFields,
  validateLearningOutcomesInput,
};
