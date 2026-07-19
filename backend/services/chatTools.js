const predictionService = require('./predictionService');
const supabaseService = require('./supabaseService');
const { TASK_TYPES } = require('../config');

// OpenAI function-calling tool registry for the chat assistant. Each tool routes into the
// SAME predictionService functions the HTTP predict routes use, so a prediction run via chat
// is persisted identically (predictions row, cost entry, model_version) to one run via the
// Roster/Predict screens - not a parallel, divergent code path.
const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'fetch_roster',
      description: "List the institution's teacher roster (id, name, and readiness-relevant stats). Call this first to resolve a teacher's name to their id before running run_teacher_prediction.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_teacher_prediction',
      description: "Run the Teacher Roles AI-disruption-exposure assessment for one teacher. Requires the teacher's id (get it from fetch_roster first).",
      parameters: {
        type: 'object',
        properties: { teacherId: { type: 'string', description: 'UUID of the teacher, from fetch_roster.' } },
        required: ['teacherId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_learning_outcome_prediction',
      description: 'Run the Learning Outcomes pass-rate-trajectory assessment for a subject/grade cohort. Cohort-level aggregates only - NEVER pass an individual student name or id, this will be rejected.',
      parameters: {
        type: 'object',
        properties: {
          subjectName: { type: 'string' },
          gradeLevel: { type: 'string' },
          historicalPassRates: {
            type: 'array',
            description: 'Chronological list of { period, passRatePercent } for this cohort.',
            items: {
              type: 'object',
              properties: { period: { type: 'string' }, passRatePercent: { type: 'number' } },
              required: ['period', 'passRatePercent'],
            },
          },
          aiToolExposureLevel: { type: 'number', description: 'Estimated 0-100 level of AI-tool exposure in this subject/grade.' },
          cohortSize: { type: 'number' },
        },
        required: ['subjectName', 'historicalPassRates', 'aiToolExposureLevel'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_curriculum_prediction',
      description: 'Run the Curriculum & Future Skills audit (Skills Obsolescence & Readiness Index) for a syllabus or course outline.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          gradeLevel: { type: 'string' },
          syllabusText: { type: 'string', description: 'The syllabus or course outline text to analyse.' },
          alpha: { type: 'number', description: 'Future-skills weighting, 0-1, defaults to 0.8.' },
        },
        required: ['title', 'syllabusText'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_predictions_history',
      description: 'List recent predictions already run for this institution, optionally filtered by task type.',
      parameters: {
        type: 'object',
        properties: {
          taskType: { type: 'string', enum: Object.values(TASK_TYPES) },
          limit: { type: 'number', description: 'Max rows to return, defaults to 10, capped at 20.' },
        },
        additionalProperties: false,
      },
    },
  },
];

async function executeTool(name, args, { client, profile }) {
  switch (name) {
    case 'fetch_roster':
      return supabaseService.listTeachers(client, profile.institution_id);

    case 'run_teacher_prediction':
      return predictionService.predictTeacherRoles({ client, profile, teacherId: args.teacherId });

    case 'run_learning_outcome_prediction':
      return predictionService.predictLearningOutcomes({ client, profile, ...args, rawBody: args });

    case 'run_curriculum_prediction':
      return predictionService.predictCurriculumSkills({ client, profile, ...args });

    case 'fetch_predictions_history': {
      const predictions = await supabaseService.listPredictions(client, profile.institution_id, args.taskType);
      const limit = Math.min(args.limit || 10, 20);
      return predictions.slice(0, limit);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = { toolDefinitions, executeTool };
