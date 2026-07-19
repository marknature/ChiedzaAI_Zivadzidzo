// Single source of truth for task types, model versions, table names, and tunables.
// Every service/route imports from here instead of hardcoding these values.

const TASK_TYPES = Object.freeze({
  TEACHER_ROLES: 'teacher_roles',
  LEARNING_OUTCOMES: 'learning_outcomes',
  CURRICULUM_SKILLS: 'curriculum_skills',
});

// Gemini is the production default. A backend operator may explicitly select one of
// the supported providers with LLM_PROVIDER; this is never chosen by a client request
// and there is deliberately no automatic cross-provider failover.
const LLM_PROVIDERS = Object.freeze({
  OPENAI: 'openai',
  GEMINI: 'gemini',
  ANTHROPIC: 'anthropic',
});

const SUPPORTED_LLM_PROVIDERS = new Set(Object.values(LLM_PROVIDERS));

function assertSupportedLlmProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  if (!SUPPORTED_LLM_PROVIDERS.has(provider)) {
    const error = new Error(`LLM_PROVIDER must be one of: ${Array.from(SUPPORTED_LLM_PROVIDERS).join(', ')}.`);
    error.code = 'LLM_PROVIDER_UNSUPPORTED';
    throw error;
  }
  return provider;
}

function configuredLlmProvider() {
  return assertSupportedLlmProvider(process.env.LLM_PROVIDER || LLM_PROVIDERS.GEMINI);
}

// Gemini is the primary provider for ZivaDzidzo. Its stable Flash model is used for
// both the schema-constrained assessment heads and the tool-enabled Assistant.
// Operators can deliberately choose a pinned OpenAI snapshot or Anthropic model
// instead; provider choice always remains backend-only.
const OPENAI_MODELS = Object.freeze({
  PREDICT: process.env.OPENAI_PREDICT_MODEL || 'gpt-4o-2024-11-20',
  CHAT: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini-2024-07-18',
});

const GEMINI_MODELS = Object.freeze({
  PREDICT: process.env.GEMINI_PREDICT_MODEL || 'gemini-3.5-flash',
  // Kept separate from PREDICT so an operator can use a different model for the
  // tool-enabled Assistant without changing the three assessment heads.
  CHAT: process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash',
});

const ANTHROPIC_MODELS = Object.freeze({
  PREDICT: process.env.ANTHROPIC_PREDICT_MODEL || 'claude-haiku-4-5-20251001',
  // This is a low-latency default, not a claim that Anthropic API usage is free.
  CHAT: process.env.ANTHROPIC_CHAT_MODEL || 'claude-haiku-4-5-20251001',
});

function predictionModelFor(provider = configuredLlmProvider()) {
  assertSupportedLlmProvider(provider);
  if (provider === LLM_PROVIDERS.OPENAI) return process.env.OPENAI_PREDICT_MODEL || OPENAI_MODELS.PREDICT;
  if (provider === LLM_PROVIDERS.GEMINI) return process.env.GEMINI_PREDICT_MODEL || GEMINI_MODELS.PREDICT;
  if (provider === LLM_PROVIDERS.ANTHROPIC) return process.env.ANTHROPIC_PREDICT_MODEL || ANTHROPIC_MODELS.PREDICT;
  throw new Error(`No prediction model configured for provider "${provider}".`);
}

function chatModelFor(provider = configuredLlmProvider()) {
  // All supported providers have an adapter for ZivaDzidzo's normalized
  // tool-enabled chat contract. Provider choice remains backend-only and is never
  // silently changed or failed over by this helper.
  assertSupportedLlmProvider(provider);
  if (provider === LLM_PROVIDERS.OPENAI) return process.env.OPENAI_CHAT_MODEL || OPENAI_MODELS.CHAT;
  if (provider === LLM_PROVIDERS.GEMINI) return process.env.GEMINI_CHAT_MODEL || GEMINI_MODELS.CHAT;
  if (provider === LLM_PROVIDERS.ANTHROPIC) return process.env.ANTHROPIC_CHAT_MODEL || ANTHROPIC_MODELS.CHAT;
  throw new Error(`No chat model configured for provider "${provider}".`);
}

// Bump the relevant tag any time a system prompt, schema, or few-shot example changes
// for that head. `predictions.model_version` is always
// `<provider>/<model>::<prompt-tag>` so a report can identify the exact route.
const PROMPT_VERSIONS = Object.freeze({
  [TASK_TYPES.TEACHER_ROLES]: 'teacher_roles_v1',
  [TASK_TYPES.LEARNING_OUTCOMES]: 'learning_outcomes_v1',
  [TASK_TYPES.CURRICULUM_SKILLS]: 'curriculum_skills_v1',
});

function modelVersionTag(taskType) {
  const tag = PROMPT_VERSIONS[taskType];
  if (!tag) throw new Error(`No prompt version registered for task_type "${taskType}"`);
  const provider = configuredLlmProvider();
  return `${provider}/${predictionModelFor(provider)}::${tag}`;
}

function chatModelVersionTag() {
  const provider = configuredLlmProvider();
  return `${provider}/${chatModelFor(provider)}::chat_consultation_v1`;
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
});

const RATE_LIMITS = Object.freeze({
  WINDOW_MS: 15 * 60 * 1000,
  MAX_PER_IP: 300,
  MAX_PER_USER: 180,
  MAX_PREDICT_PER_USER: 30,
});

const CORS_ALLOWED_ORIGINS = Object.freeze(
  (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const AI_TOOL_USAGE_FREQUENCY_NUMERIC = Object.freeze({
  never: 0,
  rarely: 1,
  sometimes: 2,
  often: 3,
  daily: 4,
});

module.exports = {
  TASK_TYPES,
  LLM_PROVIDERS,
  assertSupportedLlmProvider,
  configuredLlmProvider,
  OPENAI_MODELS,
  GEMINI_MODELS,
  ANTHROPIC_MODELS,
  predictionModelFor,
  chatModelFor,
  PROMPT_VERSIONS,
  modelVersionTag,
  chatModelVersionTag,
  TABLES,
  ROLES,
  PREDICTION_WRITE_ROLES,
  OPENAI_PRICING_PER_MILLION_TOKENS,
  RATE_LIMITS,
  CORS_ALLOWED_ORIGINS,
  AI_TOOL_USAGE_FREQUENCY_NUMERIC,
};
