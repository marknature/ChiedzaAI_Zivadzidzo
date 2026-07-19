const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

const chatTools = [
  {
    type: 'function',
    function: {
      name: 'get_school_overview',
      description: 'Return an aggregate school overview.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          institution_id: { type: 'string' },
        },
        required: ['institution_id'],
      },
    },
  },
];

const firstTurnMessages = [
  { role: 'system', content: 'You are a careful school-leader assistant.' },
  { role: 'user', content: 'How is Greenwood Secondary doing?' },
];

function restoreEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function jsonResponse(payload, ok = true) {
  return {
    ok,
    json: jest.fn().mockResolvedValue(payload),
  };
}

function allParts(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(allParts);
  const ownPart = value.functionCall || value.functionResponse ? [value] : [];
  return ownPart.concat(Object.values(value).flatMap(allParts));
}

function anthropicBlocks(messages) {
  return messages.flatMap((message) => (Array.isArray(message.content) ? message.content : []));
}

beforeEach(() => {
  jest.resetModules();
  restoreEnvironment();
  global.fetch = ORIGINAL_FETCH;
});

afterAll(() => {
  restoreEnvironment();
  global.fetch = ORIGINAL_FETCH;
});

test('Gemini normalizes a text chat completion to the OpenAI-compatible contract', async () => {
  process.env.LLM_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'gemini-chat-parity-key';
  process.env.GEMINI_CHAT_MODEL = 'gemini-chat-parity-model';
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({
    candidates: [{ content: { role: 'model', parts: [{ text: 'Greenwood is stable overall.' }] } }],
    usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 6, totalTokenCount: 20 },
  }));

  const { runChatCompletion } = require('../services/llmProviderService');
  const completion = await runChatCompletion({ messages: firstTurnMessages, tools: chatTools });

  expect(completion).toEqual({
    choices: [{ message: { role: 'assistant', content: 'Greenwood is stable overall.' } }],
    usage: { prompt_tokens: 14, completion_tokens: 6, total_tokens: 20 },
  });

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-chat-parity-model:generateContent');
  expect(options.headers['x-goog-api-key']).toBe('gemini-chat-parity-key');
  const request = JSON.parse(options.body);
  expect(request.systemInstruction.parts).toEqual([{ text: 'You are a careful school-leader assistant.' }]);
  expect(request.contents).toContainEqual({ role: 'user', parts: [{ text: 'How is Greenwood Secondary doing?' }] });
  expect(request.tools[0].functionDeclarations[0]).toMatchObject({ name: 'get_school_overview' });
});

test('Gemini converts function calls and forwards OpenAI-style tool results on the continuation turn', async () => {
  process.env.LLM_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'gemini-chat-parity-key';
  process.env.GEMINI_CHAT_MODEL = 'gemini-chat-parity-model';
  global.fetch = jest.fn()
    .mockResolvedValueOnce(jsonResponse({
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            functionCall: {
              id: 'gemini-call-1',
              name: 'get_school_overview',
              args: { institution_id: 'greenwood' },
            },
          }],
        },
      }],
      usageMetadata: { promptTokenCount: 19, candidatesTokenCount: 8, totalTokenCount: 27 },
    }))
    .mockResolvedValueOnce(jsonResponse({
      candidates: [{ content: { role: 'model', parts: [{ text: 'Greenwood has one priority readiness gap.' }] } }],
      usageMetadata: { promptTokenCount: 31, candidatesTokenCount: 9, totalTokenCount: 40 },
    }));

  const { runChatCompletion } = require('../services/llmProviderService');
  const requestedTool = await runChatCompletion({ messages: firstTurnMessages, tools: chatTools });
  const toolCall = requestedTool.choices[0].message.tool_calls[0];

  expect(requestedTool).toEqual({
    choices: [{
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'gemini-call-1',
          type: 'function',
          function: { name: 'get_school_overview', arguments: '{"institution_id":"greenwood"}' },
        }],
      },
    }],
    usage: { prompt_tokens: 19, completion_tokens: 8, total_tokens: 27 },
  });

  const continuation = await runChatCompletion({
    messages: [
      ...firstTurnMessages,
      { role: 'assistant', content: requestedTool.choices[0].message.content, tool_calls: [toolCall] },
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: '{"ok":true,"result":{"average_readiness":71}}',
      },
    ],
    tools: chatTools,
  });

  expect(continuation).toEqual({
    choices: [{ message: { role: 'assistant', content: 'Greenwood has one priority readiness gap.' } }],
    usage: { prompt_tokens: 31, completion_tokens: 9, total_tokens: 40 },
  });

  const secondRequest = JSON.parse(global.fetch.mock.calls[1][1].body);
  const parts = allParts(secondRequest.contents);
  expect(parts).toContainEqual(expect.objectContaining({
    functionCall: expect.objectContaining({ id: 'gemini-call-1', name: 'get_school_overview', args: { institution_id: 'greenwood' } }),
  }));
  expect(parts).toContainEqual(expect.objectContaining({
    functionResponse: expect.objectContaining({
      id: 'gemini-call-1',
      name: 'get_school_overview',
      response: { ok: true, result: { average_readiness: 71 } },
    }),
  }));
});

test('Anthropic normalizes a text chat completion to the OpenAI-compatible contract', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'anthropic-chat-parity-key';
  process.env.ANTHROPIC_CHAT_MODEL = 'claude-chat-parity-model';
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({
    content: [{ type: 'text', text: 'Greenwood is stable overall.' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 17, output_tokens: 7 },
  }));

  const { runChatCompletion } = require('../services/llmProviderService');
  const completion = await runChatCompletion({ messages: firstTurnMessages, tools: chatTools });

  expect(completion).toEqual({
    choices: [{ message: { role: 'assistant', content: 'Greenwood is stable overall.' } }],
    usage: { prompt_tokens: 17, completion_tokens: 7, total_tokens: 24 },
  });

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://api.anthropic.com/v1/messages');
  expect(options.headers['x-api-key']).toBe('anthropic-chat-parity-key');
  const request = JSON.parse(options.body);
  expect(request.model).toBe('claude-chat-parity-model');
  expect(request.system).toBe('You are a careful school-leader assistant.');
  expect(request.messages).toContainEqual({ role: 'user', content: 'How is Greenwood Secondary doing?' });
  expect(request.tools[0]).toMatchObject({ name: 'get_school_overview' });
});

test('Anthropic converts tool_use blocks and forwards tool_result on the continuation turn', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'anthropic-chat-parity-key';
  process.env.ANTHROPIC_CHAT_MODEL = 'claude-chat-parity-model';
  global.fetch = jest.fn()
    .mockResolvedValueOnce(jsonResponse({
      content: [
        { type: 'text', text: 'I will check the school summary.' },
        { type: 'tool_use', id: 'toolu_greenwood_1', name: 'get_school_overview', input: { institution_id: 'greenwood' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 21, output_tokens: 11 },
    }))
    .mockResolvedValueOnce(jsonResponse({
      content: [{ type: 'text', text: 'Greenwood should prioritise its low-readiness department.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 36, output_tokens: 10 },
    }));

  const { runChatCompletion } = require('../services/llmProviderService');
  const requestedTool = await runChatCompletion({ messages: firstTurnMessages, tools: chatTools });
  const toolCall = requestedTool.choices[0].message.tool_calls[0];

  expect(requestedTool).toEqual({
    choices: [{
      message: {
        role: 'assistant',
        content: 'I will check the school summary.',
        tool_calls: [{
          id: 'toolu_greenwood_1',
          type: 'function',
          function: { name: 'get_school_overview', arguments: '{"institution_id":"greenwood"}' },
        }],
      },
    }],
    usage: { prompt_tokens: 21, completion_tokens: 11, total_tokens: 32 },
  });

  const continuation = await runChatCompletion({
    messages: [
      ...firstTurnMessages,
      { role: 'assistant', content: requestedTool.choices[0].message.content, tool_calls: [toolCall] },
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: '{"ok":true,"result":{"average_readiness":71}}',
      },
    ],
    tools: chatTools,
  });

  expect(continuation).toEqual({
    choices: [{ message: { role: 'assistant', content: 'Greenwood should prioritise its low-readiness department.' } }],
    usage: { prompt_tokens: 36, completion_tokens: 10, total_tokens: 46 },
  });

  const secondRequest = JSON.parse(global.fetch.mock.calls[1][1].body);
  const blocks = anthropicBlocks(secondRequest.messages);
  expect(blocks).toContainEqual(expect.objectContaining({
    type: 'tool_use',
    id: 'toolu_greenwood_1',
    name: 'get_school_overview',
    input: { institution_id: 'greenwood' },
  }));
  expect(blocks).toContainEqual(expect.objectContaining({
    type: 'tool_result',
    tool_use_id: 'toolu_greenwood_1',
    content: '{"ok":true,"result":{"average_readiness":71}}',
  }));
});

test.each([
  ['gemini', 'GEMINI_API_KEY', 'gemini-chat-parity-key', 'Gemini'],
  ['anthropic', 'ANTHROPIC_API_KEY', 'anthropic-chat-parity-key', 'Anthropic'],
])('%s maps provider API errors to the shared request-failed contract', async (provider, keyName, keyValue, label) => {
  process.env.LLM_PROVIDER = provider;
  process.env[keyName] = keyValue;
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ error: { message: 'quota exhausted' } }, false));

  const { runChatCompletion } = require('../services/llmProviderService');
  await expect(runChatCompletion({ messages: firstTurnMessages, tools: chatTools }))
    .rejects.toMatchObject({
      code: 'LLM_PROVIDER_REQUEST_FAILED',
      provider,
      message: expect.stringContaining(`${label} rejected the request`),
    });
});
