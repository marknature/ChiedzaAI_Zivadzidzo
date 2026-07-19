// Single source of truth for task types, model versions, table names, and tunables.
// Every service/route imports from here instead of hardcoding these values.

const TASK_TYPES = Object.freeze({
  TEACHER_ROLES: 'teacher_roles',
  LEARNING_OUTCOMES: 'learning_outcomes',
  CURRICULUM_SKILLS: 'curriculum_skills',
});

// Pinned dated snapshots, not floating aliases, so an OpenAI-side model update can't
// silently change prediction behaviour underneath a fixed prompt version.
const OPENAI_MODELS = Object.freeze({
  PREDICT: process.env.OPENAI_PREDICT_MODEL || 'gpt-4o-2024-08-06',
  CHAT: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini-2024-07-18',
  // Demo-mode fallback used by the original curriculum auditor when no API key is set.
  DEMO_FALLBACK_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
});

// Bump the relevant tag any time a system prompt, schema, or few-shot example changes
// for that head. `predictions.model_version` is always `<model snapshot>::<tag>`.
const PROMPT_VERSIONS = Object.freeze({
  [TASK_TYPES.TEACHER_ROLES]: 'teacher_roles_v1',
  [TASK_TYPES.LEARNING_OUTCOMES]: 'learning_outcomes_v1',
  [TASK_TYPES.CURRICULUM_SKILLS]: 'curriculum_skills_v1',
});

function modelVersionTag(taskType) {
  const tag = PROMPT_VERSIONS[taskType];
  if (!tag) throw new Error(`No prompt version registered for task_type "${taskType}"`);
  return `${OPENAI_MODELS.PREDICT}::${tag}`;
}

const TABLES = Object.freeze({
  INSTITUTIONS: 'institutions',
  PROFILES: 'profiles',
  DEPARTMENTS: 'departments',
  SUBJECTS: 'subjects',
  TEACHERS: 'teachers',
  PREDICTIONS: 'predictions',
  CHAT_SESSIONS: 'chat_sessions',
  CHAT_MESSAGES: 'chat_messages',
  REPORTS: 'reports',
  PUSH_TOKENS: 'push_tokens',
  COST_ENTRIES: 'cost_entries',
  AUDITS_LEGACY: 'audits',
});

const ROLES = Object.freeze({
  ADMIN: 'admin',
  HEAD_TEACHER: 'head_teacher',
  TEACHER: 'teacher',
  MINISTRY_VIEWER: 'ministry_viewer',
});

const PREDICTION_WRITE_ROLES = [ROLES.ADMIN, ROLES.HEAD_TEACHER];

// USD per 1M tokens, used to auto-log LLM spend into cost_entries. Update when OpenAI
// pricing changes; keep this the only place a price appears in the codebase.
const OPENAI_PRICING_PER_MILLION_TOKENS = Object.freeze({
  [OPENAI_MODELS.PREDICT]: { input: 2.5, output: 10 },
  [OPENAI_MODELS.CHAT]: { input: 0.15, output: 0.6 },
  [OPENAI_MODELS.DEMO_FALLBACK_MODEL]: { input: 0.15, output: 0.6 },
});

const RATE_LIMITS = Object.freeze({
  WINDOW_MS: 15 * 60 * 1000,
  MAX_PER_IP: 300,
  MAX_PER_USER: 180,
  MAX_PREDICT_PER_USER: 30,
});

const AI_TOOL_USAGE_FREQUENCY_NUMERIC = Object.freeze({
  never: 0,
  rarely: 1,
  sometimes: 2,
  often: 3,
  daily: 4,
});

module.exports = {
  TASK_TYPES,
  OPENAI_MODELS,
  PROMPT_VERSIONS,
  modelVersionTag,
  TABLES,
  ROLES,
  PREDICTION_WRITE_ROLES,
  OPENAI_PRICING_PER_MILLION_TOKENS,
  RATE_LIMITS,
  AI_TOOL_USAGE_FREQUENCY_NUMERIC,
};
