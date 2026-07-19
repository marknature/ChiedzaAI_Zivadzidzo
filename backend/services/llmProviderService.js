const OpenAI = require('openai');
const {
  LLM_PROVIDERS,
  configuredLlmProvider,
  predictionModelFor,
  chatModelFor,
  OPENAI_PRICING_PER_MILLION_TOKENS,
} = require('../config');

// This module is the only place a decision-support request chooses an external
// LLM API. Provider selection is server-side through LLM_PROVIDER and never comes
// from a request body, user profile, or mobile client. There is intentionally no
// automatic failover: switching provider can change data routing, behaviour, and
// cost, so an operator must make that choice explicitly in backend configuration.

const API_KEY_ENV_BY_PROVIDER = Object.freeze({
  [LLM_PROVIDERS.OPENAI]: 'OPENAI_API_KEY',
  [LLM_PROVIDERS.GEMINI]: 'GEMINI_API_KEY',
  [LLM_PROVIDERS.ANTHROPIC]: 'ANTHROPIC_API_KEY',
});

const PROVIDER_LABELS = Object.freeze({
  [LLM_PROVIDERS.OPENAI]: 'OpenAI',
  [LLM_PROVIDERS.GEMINI]: 'Gemini',
  [LLM_PROVIDERS.ANTHROPIC]: 'Anthropic',
});

const DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

function providerRequestTimeoutMs() {
  const configured = Number.parseInt(process.env.LLM_REQUEST_TIMEOUT_MS, 10);
  if (Number.isFinite(configured) && configured >= 1_000 && configured <= 120_000) {
    return configured;
  }
  return DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS;
}

let cachedOpenaiClient = null;
let cachedOpenaiApiKey = null;

function providerError(code, message, provider) {
  const error = new Error(message);
  error.code = code;
  error.provider = provider;
  return error;
}

function providerApiKey(provider) {
  const envName = API_KEY_ENV_BY_PROVIDER[provider];
  if (!envName) {
    throw providerError('LLM_PROVIDER_UNSUPPORTED', `Unsupported LLM provider "${provider}".`, provider);
  }
  const value = process.env[envName];
  if (!value || !String(value).trim()) {
    throw providerError(
      'LLM_PROVIDER_NOT_CONFIGURED',
      `${PROVIDER_LABELS[provider]} is selected but ${envName} is not configured on the backend.`,
      provider,
    );
  }
  return String(value).trim();
}

function openaiClient(apiKey) {
  if (cachedOpenaiApiKey !== apiKey) {
    cachedOpenaiClient = new OpenAI({ apiKey });
    cachedOpenaiApiKey = apiKey;
  }
  return cachedOpenaiClient;
}

// Minimal recursive validator matching the JSON-schema shapes used by our own
// predict-head schemas (type/required/properties/items/enum/minimum/maximum).
// Native structured output is helpful but never a substitute for application-side
// validation before anything reaches Supabase or the UI.
function validate(schema, data, path = '$') {
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error(`Schema validation failed at ${path}: expected object`);
    }
    for (const key of schema.required || []) {
      if (!(key in data)) throw new Error(`Schema validation failed at ${path}: missing required field "${key}"`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in (schema.properties || {}))) throw new Error(`Schema validation failed at ${path}: unexpected field "${key}"`);
      }
    }
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (key in data) validate(propSchema, data[key], `${path}.${key}`);
    }
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(data)) throw new Error(`Schema validation failed at ${path}: expected array`);
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
      throw new Error(`Schema validation failed at ${path}: expected at least ${schema.minItems} items`);
    }
    if (typeof schema.maxItems === 'number' && data.length > schema.maxItems) {
      throw new Error(`Schema validation failed at ${path}: expected at most ${schema.maxItems} items`);
    }
    if (schema.items) data.forEach((item, index) => validate(schema.items, item, `${path}[${index}]`));
    return;
  }
  if (schema.type === 'string') {
    if (typeof data !== 'string') throw new Error(`Schema validation failed at ${path}: expected string`);
    if (schema.enum && !schema.enum.includes(data)) {
      throw new Error(`Schema validation failed at ${path}: "${data}" not in [${schema.enum.join(', ')}]`);
    }
    return;
  }
  if (schema.type === 'number') {
    if (typeof data !== 'number' || Number.isNaN(data)) throw new Error(`Schema validation failed at ${path}: expected number`);
    if (typeof schema.minimum === 'number' && data < schema.minimum) throw new Error(`Schema validation failed at ${path}: ${data} < minimum ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && data > schema.maximum) throw new Error(`Schema validation failed at ${path}: ${data} > maximum ${schema.maximum}`);
  }
}

function parseStructuredJson(text, provider) {
  if (typeof text !== 'string' || !text.trim()) {
    throw providerError('LLM_PROVIDER_INVALID_JSON', `${PROVIDER_LABELS[provider]} returned an empty structured response.`, provider);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw providerError('LLM_PROVIDER_INVALID_JSON', `${PROVIDER_LABELS[provider]} returned a response that could not be parsed as JSON.`, provider);
  }
}

// Anthropic's TypeScript/Python SDKs transform unsupported JSON-schema constraints
// before sending them and then validate against the original schema afterwards. This
// REST adapter makes the same distinction: retain the shape provider-side, describe
// numeric/cardinality constraints in prose, and enforce the complete original schema
// locally in validate()/Zod below.
function anthropicOutputSchema(value) {
  if (Array.isArray(value)) return value.map(anthropicOutputSchema);
  if (!value || typeof value !== 'object') return value;

  const constraints = [];
  const copy = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'minimum') { constraints.push(`minimum ${nested}`); continue; }
    if (key === 'maximum') { constraints.push(`maximum ${nested}`); continue; }
    if (key === 'minItems') { constraints.push(`at least ${nested} item${nested === 1 ? '' : 's'}`); continue; }
    if (key === 'maxItems') { constraints.push(`at most ${nested} item${nested === 1 ? '' : 's'}`); continue; }
    if (key === 'minLength') { constraints.push(`at least ${nested} characters`); continue; }
    if (key === 'maxLength') { constraints.push(`at most ${nested} characters`); continue; }
    copy[key] = anthropicOutputSchema(nested);
  }

  if (copy.type === 'object' && copy.additionalProperties === undefined) copy.additionalProperties = false;
  if (constraints.length) {
    const existing = typeof copy.description === 'string' && copy.description.trim() ? `${copy.description.trim()} ` : '';
    copy.description = `${existing}Application validation requires ${constraints.join(', ')}.`;
  }
  return copy;
}

function estimateCostUsd(model, usage) {
  const rates = OPENAI_PRICING_PER_MILLION_TOKENS[model];
  if (!rates || !usage) return 0;
  const inputCost = ((usage.prompt_tokens || 0) / 1_000_000) * rates.input;
  const outputCost = ((usage.completion_tokens || 0) / 1_000_000) * rates.output;
  return Number((inputCost + outputCost).toFixed(6));
}

function structuredResponse({ result, provider, model, usage }) {
  const isOpenAi = provider === LLM_PROVIDERS.OPENAI;
  return {
    result,
    providerUsed: provider,
    modelUsed: model,
    usage,
    // Prices for optional providers are deliberately not guessed. The existing
    // cost entry is written only when a known OpenAI rate is configured.
    costUsd: isOpenAi ? estimateCostUsd(model, usage) : null,
    costEstimateAvailable: isOpenAi && Boolean(OPENAI_PRICING_PER_MILLION_TOKENS[model]),
  };
}

async function postJson({ url, headers, body, provider }) {
  if (typeof fetch !== 'function') {
    throw providerError('LLM_PROVIDER_REQUEST_FAILED', 'This Node runtime does not provide fetch for the selected LLM provider.', provider);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerRequestTimeoutMs());
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw providerError('LLM_PROVIDER_REQUEST_TIMEOUT', `${PROVIDER_LABELS[provider]} did not respond in time. Please retry.`, provider);
    }
    throw providerError('LLM_PROVIDER_REQUEST_FAILED', `${PROVIDER_LABELS[provider]} could not be reached.`, provider);
  } finally {
    clearTimeout(timeout);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw providerError('LLM_PROVIDER_REQUEST_FAILED', `${PROVIDER_LABELS[provider]} returned an unreadable API response.`, provider);
  }

  if (!response.ok) {
    throw providerError('LLM_PROVIDER_REQUEST_FAILED', `${PROVIDER_LABELS[provider]} rejected the request. Check the backend provider configuration and account.`, provider);
  }
  return payload;
}

async function runOpenAiStructuredPrediction({ schema, systemPrompt, userContent, model }) {
  const provider = LLM_PROVIDERS.OPENAI;
  const openai = openaiClient(providerApiKey(provider));
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: schema },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });
  } catch {
    throw providerError('LLM_PROVIDER_REQUEST_FAILED', 'OpenAI rejected the structured prediction request. Check the backend provider configuration and account.', provider);
  }

  return {
    provider,
    model,
    text: completion?.choices?.[0]?.message?.content,
    usage: completion?.usage,
  };
}

async function runGeminiStructuredPrediction({ schema, systemPrompt, userContent, model }) {
  const provider = LLM_PROVIDERS.GEMINI;
  const apiKey = providerApiKey(provider);
  const payload = await postJson({
    provider,
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: schema.schema,
      },
    },
  });

  const parts = payload?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.filter((part) => typeof part?.text === 'string').map((part) => part.text).join('')
    : '';
  return {
    provider,
    model,
    text,
    usage: {
      prompt_tokens: payload?.usageMetadata?.promptTokenCount || 0,
      completion_tokens: payload?.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: payload?.usageMetadata?.totalTokenCount || 0,
    },
  };
}

async function runAnthropicStructuredPrediction({ schema, systemPrompt, userContent, model }) {
  const provider = LLM_PROVIDERS.ANTHROPIC;
  const apiKey = providerApiKey(provider);
  const payload = await postJson({
    provider,
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model,
      max_tokens: 2048,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: anthropicOutputSchema(schema.schema),
        },
      },
    },
  });

  if (payload?.stop_reason === 'refusal' || payload?.stop_reason === 'max_tokens') {
    throw providerError('LLM_PROVIDER_INVALID_JSON', 'Anthropic did not complete a valid structured prediction response.', provider);
  }
  const text = Array.isArray(payload?.content)
    ? payload.content.filter((part) => part?.type === 'text' && typeof part.text === 'string').map((part) => part.text).join('')
    : '';
  return {
    provider,
    model,
    text,
    usage: {
      prompt_tokens: payload?.usage?.input_tokens || 0,
      completion_tokens: payload?.usage?.output_tokens || 0,
      total_tokens: (payload?.usage?.input_tokens || 0) + (payload?.usage?.output_tokens || 0),
    },
  };
}

// Runs every schema-constrained prediction head (and the legacy compatibility audit)
// through the selected provider while preserving one strict output contract.
async function runStructuredPrediction({ schema, zodSchema, systemPrompt, userContent, model }) {
  const provider = configuredLlmProvider();
  const selectedModel = model || predictionModelFor(provider);
  let response;

  if (provider === LLM_PROVIDERS.OPENAI) {
    response = await runOpenAiStructuredPrediction({ schema, systemPrompt, userContent, model: selectedModel });
  } else if (provider === LLM_PROVIDERS.GEMINI) {
    response = await runGeminiStructuredPrediction({ schema, systemPrompt, userContent, model: selectedModel });
  } else if (provider === LLM_PROVIDERS.ANTHROPIC) {
    response = await runAnthropicStructuredPrediction({ schema, systemPrompt, userContent, model: selectedModel });
  } else {
    throw providerError('LLM_PROVIDER_UNSUPPORTED', `Unsupported LLM provider "${provider}".`, provider);
  }

  const parsed = parseStructuredJson(response.text, provider);
  validate(schema.schema, parsed);
  if (zodSchema) zodSchema.parse(parsed);
  return structuredResponse({ result: parsed, provider, model: selectedModel, usage: response.usage });
}

// The route stores a deliberately small, OpenAI-compatible internal conversation
// protocol. These helpers adapt that protocol at the provider boundary only. They
// do not validate, authorize, or execute a tool: those checks remain in chat.js and
// chatTools.js, before anything can read institution data or run a prediction.
function stringContent(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function parseToolArguments(value, provider) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const source = typeof value === 'string' && value.trim() ? value : '{}';
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw providerError(
      'LLM_PROVIDER_INVALID_TOOL_CALL',
      `${PROVIDER_LABELS[provider]} could not translate a persisted tool-call argument object.`,
      provider,
    );
  }
}

function parseToolResult(content) {
  const source = stringContent(content);
  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Tool results are server-generated JSON today, but retain an opaque string if
    // a historical record cannot be parsed rather than inventing a structure.
  }
  return { result: source };
}

function providerToolCallId(value, provider) {
  if (typeof value === 'string' && value.trim()) return value;
  // Gemini may omit ids on older model versions. The route needs a durable id to
  // pair its server-side result with the next turn, so generate one only at this
  // adapter boundary. Anthropic/OpenAI normally supply their own ids.
  const { randomUUID } = require('crypto');
  return `call_${provider}_${randomUUID()}`;
}

function normalizeGeminiToolCalls(parts) {
  const calls = [];
  for (const part of parts || []) {
    const functionCall = part?.functionCall;
    if (!functionCall) continue;
    if (typeof functionCall.name !== 'string' || !functionCall.name.trim()) {
      throw providerError('LLM_PROVIDER_INVALID_TOOL_CALL', 'Gemini returned a tool call without a function name.', LLM_PROVIDERS.GEMINI);
    }
    const normalized = {
      id: providerToolCallId(functionCall.id, LLM_PROVIDERS.GEMINI),
      type: 'function',
      function: {
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.args && typeof functionCall.args === 'object' && !Array.isArray(functionCall.args)
          ? functionCall.args
          : {}),
      },
    };
    // Gemini's thinking models can require this opaque value on the next function
    // response. It remains internal metadata and is stripped before an OpenAI API
    // call should an operator deliberately change providers between conversations.
    if (typeof part.thoughtSignature === 'string' && part.thoughtSignature) {
      normalized.provider_metadata = { gemini: { thoughtSignature: part.thoughtSignature } };
    }
    calls.push(normalized);
  }
  return calls;
}

function normalizeAnthropicToolCalls(blocks) {
  const calls = [];
  for (const block of blocks || []) {
    if (block?.type !== 'tool_use') continue;
    if (typeof block.name !== 'string' || !block.name.trim()) {
      throw providerError('LLM_PROVIDER_INVALID_TOOL_CALL', 'Anthropic returned a tool call without a function name.', LLM_PROVIDERS.ANTHROPIC);
    }
    calls.push({
      id: providerToolCallId(block.id, LLM_PROVIDERS.ANTHROPIC),
      type: 'function',
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input && typeof block.input === 'object' && !Array.isArray(block.input) ? block.input : {}),
      },
    });
  }
  return calls;
}

function geminiToolSchema(value) {
  if (Array.isArray(value)) return value.map(geminiToolSchema);
  if (!value || typeof value !== 'object') return value;

  // Gemini function declarations use a subset of OpenAPI/JSON Schema. Preserve
  // the meaningful declaration fields and omit OpenAI-only/strictness keywords;
  // the actual tool routes still validate inputs server-side.
  const permitted = new Set(['type', 'description', 'properties', 'items', 'required', 'enum', 'nullable', 'format']);
  const copy = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!permitted.has(key)) continue;
    if (key === 'properties') {
      copy.properties = Object.fromEntries(Object.entries(nested || {}).map(([name, schema]) => [name, geminiToolSchema(schema)]));
    } else if (key === 'items') {
      copy.items = geminiToolSchema(nested);
    } else {
      copy[key] = geminiToolSchema(nested);
    }
  }
  return copy;
}

function geminiFunctionDeclarations(tools) {
  return (tools || [])
    .filter((tool) => tool?.type === 'function' && tool.function?.name)
    .map((tool) => ({
      name: tool.function.name,
      ...(tool.function.description ? { description: tool.function.description } : {}),
      parameters: geminiToolSchema(tool.function.parameters || { type: 'object', properties: {} }),
    }));
}

function anthropicTools(tools) {
  return (tools || [])
    .filter((tool) => tool?.type === 'function' && tool.function?.name)
    .map((tool) => ({
      name: tool.function.name,
      ...(tool.function.description ? { description: tool.function.description } : {}),
      input_schema: tool.function.parameters || { type: 'object', properties: {} },
    }));
}

function geminiToolConfig(toolChoice) {
  if (!toolChoice || toolChoice === 'auto') return undefined;
  if (toolChoice === 'none') return { functionCallingConfig: { mode: 'NONE' } };
  if (toolChoice === 'required') return { functionCallingConfig: { mode: 'ANY' } };
  const name = toolChoice?.type === 'function' ? toolChoice.function?.name : undefined;
  if (name) return { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [name] } };
  return undefined;
}

function anthropicToolChoice(toolChoice) {
  if (!toolChoice || toolChoice === 'auto') return { type: 'auto' };
  if (toolChoice === 'required') return { type: 'any' };
  const name = toolChoice?.type === 'function' ? toolChoice.function?.name : undefined;
  if (name) return { type: 'tool', name };
  return undefined;
}

function mapGeminiMessages(messages) {
  const systemParts = [];
  const contents = [];
  const toolNamesById = new Map();
  let pendingToolResponseParts = [];

  function flushToolResponses() {
    if (!pendingToolResponseParts.length) return;
    contents.push({ role: 'user', parts: pendingToolResponseParts });
    pendingToolResponseParts = [];
  }

  for (const message of messages || []) {
    const role = message?.role;
    if (role === 'system') {
      const content = stringContent(message.content);
      if (content) systemParts.push({ text: content });
      continue;
    }

    if (role === 'tool') {
      const toolCallId = message.tool_call_id;
      const name = toolNamesById.get(toolCallId) || message.name;
      if (!name) {
        throw providerError(
          'LLM_PROVIDER_INVALID_TOOL_CALL',
          'Gemini cannot continue a tool result without its matching assistant function call.',
          LLM_PROVIDERS.GEMINI,
        );
      }
      const functionResponse = {
        name,
        response: parseToolResult(message.content),
        ...(toolCallId ? { id: toolCallId } : {}),
      };
      pendingToolResponseParts.push({ functionResponse });
      continue;
    }

    flushToolResponses();
    if (role === 'user') {
      contents.push({ role: 'user', parts: [{ text: stringContent(message.content) }] });
      continue;
    }

    if (role === 'assistant') {
      const parts = [];
      const content = stringContent(message.content);
      if (content) parts.push({ text: content });
      for (const toolCall of message.tool_calls || []) {
        const name = toolCall?.function?.name;
        if (!name) {
          throw providerError('LLM_PROVIDER_INVALID_TOOL_CALL', 'Gemini cannot translate an assistant tool call without a function name.', LLM_PROVIDERS.GEMINI);
        }
        const id = providerToolCallId(toolCall.id, LLM_PROVIDERS.GEMINI);
        toolNamesById.set(id, name);
        const functionCall = { id, name, args: parseToolArguments(toolCall.function?.arguments, LLM_PROVIDERS.GEMINI) };
        const signature = toolCall?.provider_metadata?.gemini?.thoughtSignature;
        parts.push({
          functionCall,
          ...(typeof signature === 'string' && signature ? { thoughtSignature: signature } : {}),
        });
      }
      if (parts.length) contents.push({ role: 'model', parts });
      continue;
    }

    throw providerError('LLM_PROVIDER_INVALID_CHAT_MESSAGE', `Gemini cannot translate chat role "${String(role)}".`, LLM_PROVIDERS.GEMINI);
  }
  flushToolResponses();
  return { systemInstruction: systemParts.length ? { parts: systemParts } : undefined, contents };
}

function asAnthropicBlocks(content) {
  if (Array.isArray(content)) return content;
  return [{ type: 'text', text: stringContent(content) }];
}

function appendAnthropicMessage(messages, role, content) {
  const previous = messages[messages.length - 1];
  if (!previous || previous.role !== role) {
    messages.push({ role, content });
    return;
  }

  // Anthropic requires alternate user/assistant turns. Historical OpenAI-form
  // messages are normally already alternating, but merge a same-role edge case
  // into blocks instead of issuing an invalid request.
  previous.content = [...asAnthropicBlocks(previous.content), ...asAnthropicBlocks(content)];
}

function mapAnthropicMessages(messages) {
  const systemParts = [];
  const mapped = [];
  let pendingToolResults = [];

  function flushToolResults() {
    if (!pendingToolResults.length) return;
    appendAnthropicMessage(mapped, 'user', pendingToolResults);
    pendingToolResults = [];
  }

  for (const message of messages || []) {
    const role = message?.role;
    if (role === 'system') {
      const content = stringContent(message.content);
      if (content) systemParts.push(content);
      continue;
    }

    if (role === 'tool') {
      const parsed = parseToolResult(message.content);
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: message.tool_call_id,
        content: stringContent(message.content),
        ...(parsed.ok === false ? { is_error: true } : {}),
      });
      continue;
    }

    flushToolResults();
    if (role === 'user') {
      appendAnthropicMessage(mapped, 'user', stringContent(message.content));
      continue;
    }

    if (role === 'assistant') {
      const blocks = [];
      const content = stringContent(message.content);
      if (content) blocks.push({ type: 'text', text: content });
      for (const toolCall of message.tool_calls || []) {
        const name = toolCall?.function?.name;
        if (!name) {
          throw providerError('LLM_PROVIDER_INVALID_TOOL_CALL', 'Anthropic cannot translate an assistant tool call without a function name.', LLM_PROVIDERS.ANTHROPIC);
        }
        blocks.push({
          type: 'tool_use',
          id: providerToolCallId(toolCall.id, LLM_PROVIDERS.ANTHROPIC),
          name,
          input: parseToolArguments(toolCall.function?.arguments, LLM_PROVIDERS.ANTHROPIC),
        });
      }
      if (blocks.length) appendAnthropicMessage(mapped, 'assistant', blocks);
      continue;
    }

    throw providerError('LLM_PROVIDER_INVALID_CHAT_MESSAGE', `Anthropic cannot translate chat role "${String(role)}".`, LLM_PROVIDERS.ANTHROPIC);
  }
  flushToolResults();
  return { system: systemParts.join('\n\n'), messages: mapped };
}

function normalizedChatUsage({ promptTokens, completionTokens }) {
  const prompt_tokens = Number(promptTokens) || 0;
  const completion_tokens = Number(completionTokens) || 0;
  return { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens };
}

function normalizedChatCompletion(message, usage) {
  return { choices: [{ message }], usage };
}

async function runGeminiChatCompletion({ messages, tools, model, toolChoice }) {
  const provider = LLM_PROVIDERS.GEMINI;
  const apiKey = providerApiKey(provider);
  const mapped = mapGeminiMessages(messages);
  const declarations = geminiFunctionDeclarations(tools);
  const toolConfig = geminiToolConfig(toolChoice);
  const payload = await postJson({
    provider,
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: {
      ...(mapped.systemInstruction ? { systemInstruction: mapped.systemInstruction } : {}),
      contents: mapped.contents,
      ...(declarations.length && toolChoice !== 'none' ? { tools: [{ functionDeclarations: declarations }] } : {}),
      ...(toolConfig ? { toolConfig } : {}),
    },
  });

  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw providerError('LLM_PROVIDER_INVALID_RESPONSE', 'Gemini returned no readable chat candidate.', provider);
  }
  const toolCalls = normalizeGeminiToolCalls(parts);
  const text = parts.filter((part) => typeof part?.text === 'string').map((part) => part.text).join('');
  const message = {
    role: 'assistant',
    content: text || (toolCalls.length ? null : ''),
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };
  return normalizedChatCompletion(message, normalizedChatUsage({
    promptTokens: payload?.usageMetadata?.promptTokenCount,
    completionTokens: payload?.usageMetadata?.candidatesTokenCount,
  }));
}

async function runAnthropicChatCompletion({ messages, tools, model, toolChoice }) {
  const provider = LLM_PROVIDERS.ANTHROPIC;
  const apiKey = providerApiKey(provider);
  const mapped = mapAnthropicMessages(messages);
  const convertedTools = anthropicTools(tools);
  const choice = anthropicToolChoice(toolChoice);
  const payload = await postJson({
    provider,
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model,
      max_tokens: 2048,
      system: mapped.system,
      messages: mapped.messages,
      ...(convertedTools.length && toolChoice !== 'none' ? { tools: convertedTools } : {}),
      ...(convertedTools.length && toolChoice !== 'none' && choice ? { tool_choice: choice } : {}),
    },
  });

  const blocks = payload?.content;
  if (!Array.isArray(blocks)) {
    throw providerError('LLM_PROVIDER_INVALID_RESPONSE', 'Anthropic returned no readable chat content.', provider);
  }
  const toolCalls = normalizeAnthropicToolCalls(blocks);
  const text = blocks.filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('');
  const message = {
    role: 'assistant',
    content: text || (toolCalls.length ? null : ''),
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };
  return normalizedChatCompletion(message, normalizedChatUsage({
    promptTokens: payload?.usage?.input_tokens,
    completionTokens: payload?.usage?.output_tokens,
  }));
}

// Returns the one durable internal chat shape expected by routes/chat.js:
// choices[0].message (with OpenAI-compatible tool_calls) plus normalized usage.
// Provider selection remains explicit and backend-only; a provider error never
// triggers an automatic request to a different provider.
async function runChatCompletion({ messages, tools, model, toolChoice = 'auto' }) {
  const provider = configuredLlmProvider();
  const selectedModel = model || chatModelFor(provider);

  if (provider === LLM_PROVIDERS.OPENAI) {
    const openai = openaiClient(providerApiKey(provider));
    try {
      // Preserve the existing OpenAI Chat Completions request/response behaviour.
      return await openai.chat.completions.create({
        model: selectedModel,
        messages,
        ...(tools ? { tools, tool_choice: toolChoice } : {}),
      });
    } catch {
      throw providerError('LLM_PROVIDER_REQUEST_FAILED', 'OpenAI rejected the chat request. Check the backend provider configuration and account.', provider);
    }
  }

  if (provider === LLM_PROVIDERS.GEMINI) {
    return runGeminiChatCompletion({ messages, tools, model: selectedModel, toolChoice });
  }
  if (provider === LLM_PROVIDERS.ANTHROPIC) {
    return runAnthropicChatCompletion({ messages, tools, model: selectedModel, toolChoice });
  }
  throw providerError('LLM_PROVIDER_UNSUPPORTED', `Unsupported LLM provider "${provider}".`, provider);
}

module.exports = {
  runStructuredPrediction,
  runChatCompletion,
  estimateCostUsd,
  validate,
  providerApiKey,
  anthropicOutputSchema,
};
