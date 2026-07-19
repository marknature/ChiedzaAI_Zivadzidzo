const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

const schema = {
  name: 'provider_router_unit_test',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['score'],
    properties: { score: { type: 'number', minimum: 0, maximum: 100 } },
  },
};

function resetEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

beforeEach(() => {
  jest.resetModules();
  resetEnvironment();
  global.fetch = ORIGINAL_FETCH;
});

afterAll(() => {
  resetEnvironment();
  global.fetch = ORIGINAL_FETCH;
});

test('OpenAI is the default provider and persisted prediction metadata names provider and model', () => {
  delete process.env.LLM_PROVIDER;
  const { configuredLlmProvider, modelVersionTag, TASK_TYPES } = require('../config');

  expect(configuredLlmProvider()).toBe('openai');
  expect(modelVersionTag(TASK_TYPES.TEACHER_ROLES)).toContain('openai/gpt-4o-2024-11-20::teacher_roles_v1');
});

test('an explicitly selected assessment provider is recorded in the prediction model version', () => {
  process.env.LLM_PROVIDER = 'gemini';
  process.env.GEMINI_PREDICT_MODEL = 'gemini-unit-test-model';
  const { modelVersionTag, TASK_TYPES } = require('../config');

  expect(modelVersionTag(TASK_TYPES.LEARNING_OUTCOMES))
    .toBe('gemini/gemini-unit-test-model::learning_outcomes_v1');
});

test('Gemini structured assessments send a server-side JSON schema and retain local validation', async () => {
  process.env.LLM_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'gemini-unit-test-key';
  process.env.GEMINI_PREDICT_MODEL = 'gemini-unit-test-model';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: '{"score":72}' }] } }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18 },
    }),
  });

  const { runStructuredPrediction } = require('../services/llmProviderService');
  const response = await runStructuredPrediction({
    schema,
    systemPrompt: 'Return the score only.',
    userContent: 'Assess this aggregate.',
  });

  expect(response).toMatchObject({
    result: { score: 72 },
    providerUsed: 'gemini',
    modelUsed: 'gemini-unit-test-model',
    costUsd: null,
    costEstimateAvailable: false,
    usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
  });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-unit-test-model:generateContent');
  expect(url).not.toContain('gemini-unit-test-key');
  expect(options.headers['x-goog-api-key']).toBe('gemini-unit-test-key');
  const request = JSON.parse(options.body);
  expect(request.systemInstruction.parts[0].text).toBe('Return the score only.');
  expect(request.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json' });
  expect(request.generationConfig.responseJsonSchema).toEqual(schema.schema);
});

test('Anthropic structured assessments use output_config.format and report usage without a guessed cost', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'anthropic-unit-test-key';
  process.env.ANTHROPIC_PREDICT_MODEL = 'claude-unit-test-model';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"score":81}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 13, output_tokens: 9 },
    }),
  });

  const { runStructuredPrediction } = require('../services/llmProviderService');
  const response = await runStructuredPrediction({
    schema,
    systemPrompt: 'Return the score only.',
    userContent: 'Assess this aggregate.',
  });

  expect(response).toMatchObject({
    result: { score: 81 },
    providerUsed: 'anthropic',
    modelUsed: 'claude-unit-test-model',
    costUsd: null,
    costEstimateAvailable: false,
    usage: { prompt_tokens: 13, completion_tokens: 9, total_tokens: 22 },
  });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://api.anthropic.com/v1/messages');
  expect(options.headers['x-api-key']).toBe('anthropic-unit-test-key');
  const request = JSON.parse(options.body);
  expect(request.output_config.format).toMatchObject({
    type: 'json_schema',
    schema: {
      type: 'object',
      required: ['score'],
      additionalProperties: false,
      properties: { score: { type: 'number' } },
    },
  });
  expect(request.output_config.format.schema.properties.score.minimum).toBeUndefined();
  expect(request.output_config.format.schema.properties.score.description).toContain('minimum 0');
  expect(request.messages).toEqual([{ role: 'user', content: 'Assess this aggregate.' }]);
});

test('a selected provider never falls back to OpenAI when its own key is absent', async () => {
  process.env.LLM_PROVIDER = 'gemini';
  process.env.OPENAI_API_KEY = 'an-openai-key-is-not-a-gemini-fallback';
  delete process.env.GEMINI_API_KEY;

  const { runStructuredPrediction } = require('../services/llmProviderService');
  await expect(runStructuredPrediction({ schema, systemPrompt: 'x', userContent: 'y' }))
    .rejects.toMatchObject({ code: 'LLM_PROVIDER_NOT_CONFIGURED' });
});

test('provider output is rejected if it violates the same strict schema contract', async () => {
  process.env.LLM_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'gemini-unit-test-key';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: '{"score":72,"unexpected":true}' }] } }],
    }),
  });

  const { runStructuredPrediction } = require('../services/llmProviderService');
  await expect(runStructuredPrediction({ schema, systemPrompt: 'x', userContent: 'y' }))
    .rejects.toThrow(/unexpected field/i);
});

test('tool-enabled chat fails closed when a selected optional provider has no backend key', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  const { runChatCompletion } = require('../services/llmProviderService');

  await expect(runChatCompletion({ messages: [{ role: 'user', content: 'Hello' }], tools: [] }))
    .rejects.toMatchObject({ code: 'LLM_PROVIDER_NOT_CONFIGURED', provider: 'anthropic' });
});
