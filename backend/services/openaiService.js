const OpenAI = require('openai');
const { OPENAI_MODELS, OPENAI_PRICING_PER_MILLION_TOKENS } = require('../config');

let client = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// Minimal recursive validator matching the specific JSON-schema shapes used by our own
// predict-head schemas (type/required/properties/items/enum/minimum/maximum). Not a general
// JSON Schema implementation - `strict: true` mode should already guarantee shape, but LLM
// APIs can still time out, get interrupted, or (rarely) violate the contract, so this is the
// coded failure path prompt.md asks for rather than trusting the response blindly.
function validate(schema, data, path = '$') {
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error(`Schema validation failed at ${path}: expected object`);
    }
    for (const key of schema.required || []) {
      if (!(key in data)) throw new Error(`Schema validation failed at ${path}: missing required field "${key}"`);
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
    if (schema.items) data.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`));
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

function estimateCostUsd(model, usage) {
  const rates = OPENAI_PRICING_PER_MILLION_TOKENS[model];
  if (!rates || !usage) return 0;
  const inputCost = ((usage.prompt_tokens || 0) / 1_000_000) * rates.input;
  const outputCost = ((usage.completion_tokens || 0) / 1_000_000) * rates.output;
  return Number((inputCost + outputCost).toFixed(6));
}

// Runs one structured-output predict-head call. Returns the parsed+validated result plus
// token usage/cost so the caller can persist both the prediction and its cost_entries row.
// Set `allowFallback: true` for the legacy demo-mode path (curriculum audit) where no API
// key is treated as "run in demo mode" rather than an error - the three real predict heads
// should NOT set this, a missing key there is a real configuration error.
async function runStructuredPrediction({ schema, systemPrompt, userContent, model = OPENAI_MODELS.PREDICT }) {
  const openai = getClient();
  if (!openai) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.code = 'OPENAI_NOT_CONFIGURED';
    throw error;
  }

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
  } catch (error) {
    const wrapped = new Error(`OpenAI request failed: ${error.message}`);
    wrapped.code = 'OPENAI_REQUEST_FAILED';
    throw wrapped;
  }

  let parsed;
  try {
    parsed = JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    const wrapped = new Error('OpenAI returned a response that could not be parsed as JSON.');
    wrapped.code = 'OPENAI_INVALID_JSON';
    throw wrapped;
  }

  validate(schema.schema, parsed);

  const usage = completion.usage;
  return {
    result: parsed,
    modelUsed: model,
    usage,
    costUsd: estimateCostUsd(model, usage),
  };
}

// Free-form conversational call for the chat assistant (tool-calling, no JSON Schema
// constraint) - deliberately separate from runStructuredPrediction, which stays focused on
// the schema-constrained predict heads.
async function runChatCompletion({ messages, tools, model = OPENAI_MODELS.CHAT, toolChoice = 'auto' }) {
  const openai = getClient();
  if (!openai) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.code = 'OPENAI_NOT_CONFIGURED';
    throw error;
  }
  try {
    return await openai.chat.completions.create({
      model,
      messages,
      ...(tools ? { tools, tool_choice: toolChoice } : {}),
    });
  } catch (error) {
    const wrapped = new Error(`OpenAI request failed: ${error.message}`);
    wrapped.code = 'OPENAI_REQUEST_FAILED';
    throw wrapped;
  }
}

module.exports = { runStructuredPrediction, runChatCompletion, estimateCostUsd, validate };
