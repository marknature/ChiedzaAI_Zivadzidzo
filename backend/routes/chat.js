const express = require('express');
const { requireAuth } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const { runChatCompletion, estimateCostUsd } = require('../services/openaiService');
const { toolDefinitions, executeTool } = require('../services/chatTools');
const { chatModelFor } = require('../config');
const { userRequestLimiter } = require('../middleware/security');
const { rejectLearnerIdentifiers } = require('../services/privacyService');

const router = express.Router();
router.use(requireAuth);
router.use(userRequestLimiter);

const SYSTEM_PROMPT = `You are the ZivaDzidzo assistant, helping school leaders and teachers understand AI-driven \
disruption to their curriculum, teacher roles, and learning outcomes. Call tools to look up the roster, run real \
predictions, and check prediction history - always call a tool rather than guessing a score yourself. When a \
prediction comes back, summarise it in plain language and mention its caveats. Never ask for or accept an \
individual student's name or ID - the learning-outcomes tool only accepts cohort/subject-level data and will \
reject anything else.`;

const MAX_TOOL_ROUNDS = 4;
const MAX_TOOL_RESULT_CHARS = 8000;

// Every tool_calls value we persist has one of two shapes depending on role:
//   assistant row that requested tools: the normalized OpenAI-compatible tool_calls array
//   tool row (the result): { tool_call_id, name }
// Provider adapters normalize Gemini and Anthropic calls into this durable internal
// shape too, so the route can safely execute the same server-side tool contract.
function toOpenAIMessage(row) {
  if (row.role === 'assistant' && Array.isArray(row.tool_calls) && row.tool_calls.length) {
    return { role: 'assistant', content: row.content || null, tool_calls: row.tool_calls };
  }
  if (row.role === 'tool') {
    return { role: 'tool', tool_call_id: row.tool_calls?.tool_call_id, content: row.content || '' };
  }
  return { role: row.role, content: row.content || '' };
}

router.get('/session', async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    let session = await supabaseService.getLatestChatSession(client, req.profile.institution_id, req.profile.id);
    if (!session) {
      session = await supabaseService.createChatSession(client, req.profile.institution_id, req.profile.id, null);
    }
    const messages = await supabaseService.listChatMessages(client, session.id);
    res.json({ success: true, session, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/session/new', async (req, res) => {
  try {
    const client = supabaseService.clientForToken(req.authToken);
    const session = await supabaseService.createChatSession(client, req.profile.institution_id, req.profile.id, req.body?.title || null);
    res.status(201).json({ success: true, session, messages: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/message', async (req, res) => {
  const { sessionId, content } = req.body || {};
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, error: 'content is required.' });
  }

  try {
    rejectLearnerIdentifiers(content.trim());
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  try {
    const client = supabaseService.clientForToken(req.authToken);
    const session = sessionId
      ? await supabaseService.getChatSession(client, sessionId, req.profile.institution_id, req.profile.id)
      : (await supabaseService.getLatestChatSession(client, req.profile.institution_id, req.profile.id))
        || (await supabaseService.createChatSession(client, req.profile.institution_id, req.profile.id, null));
    if (!session) {
      return res.status(404).json({ success: false, error: 'Chat session not found.' });
    }

    const priorMessages = await supabaseService.listChatMessages(client, session.id);
    await supabaseService.insertChatMessage(client, { session_id: session.id, role: 'user', content: content.trim() });

    const workingMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...priorMessages.map(toOpenAIMessage),
      { role: 'user', content: content.trim() },
    ];

    const usageTotals = { prompt_tokens: 0, completion_tokens: 0 };
    const toolCallLog = [];
    let finalAssistantContent = null;
    const selectedChatModel = chatModelFor();

    for (let round = 0; round < MAX_TOOL_ROUNDS && finalAssistantContent === null; round += 1) {
      const completion = await runChatCompletion({ messages: workingMessages, tools: toolDefinitions, model: selectedChatModel });
      if (completion.usage) {
        usageTotals.prompt_tokens += completion.usage.prompt_tokens || 0;
        usageTotals.completion_tokens += completion.usage.completion_tokens || 0;
      }

      const assistantMessage = completion.choices[0].message;

      if (assistantMessage.tool_calls?.length) {
        await supabaseService.insertChatMessage(client, {
          session_id: session.id,
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls,
        });
        workingMessages.push({ role: 'assistant', content: assistantMessage.content || null, tool_calls: assistantMessage.tool_calls });

        for (const toolCall of assistantMessage.tool_calls) {
          let resultPayload;
          try {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            const result = await executeTool(toolCall.function.name, args, { client, profile: req.profile });
            resultPayload = { ok: true, result };
          } catch (toolError) {
            resultPayload = { ok: false, error: toolError.message };
          }
          const toolContent = JSON.stringify(resultPayload).slice(0, MAX_TOOL_RESULT_CHARS);

          await supabaseService.insertChatMessage(client, {
            session_id: session.id,
            role: 'tool',
            content: toolContent,
            tool_calls: { tool_call_id: toolCall.id, name: toolCall.function.name },
          });
          workingMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolContent });
          toolCallLog.push({ name: toolCall.function.name, ok: resultPayload.ok });
        }
        continue;
      }

      finalAssistantContent = assistantMessage.content || '';
      await supabaseService.insertChatMessage(client, { session_id: session.id, role: 'assistant', content: finalAssistantContent, tool_calls: null });
    }

    if (finalAssistantContent === null) {
      finalAssistantContent = "I wasn't able to finish that within the allowed number of tool calls - could you narrow the request?";
      await supabaseService.insertChatMessage(client, { session_id: session.id, role: 'assistant', content: finalAssistantContent, tool_calls: null });
    }

    const costUsd = estimateCostUsd(selectedChatModel, usageTotals);
    await supabaseService.insertAutoLlmCostEntry({
      institutionId: req.profile.institution_id,
      amountUsd: costUsd,
      note: `Chat turn (${selectedChatModel}, ${toolCallLog.length} tool call(s))`,
      createdBy: req.profile.id,
    });

    res.json({ success: true, sessionId: session.id, reply: finalAssistantContent, toolCallLog });
  } catch (error) {
    if (
      error.code === 'LLM_PROVIDER_NOT_CONFIGURED'
      || error.code === 'LLM_PROVIDER_UNSUPPORTED'
      || error.code === 'LLM_PROVIDER_CAPABILITY_UNSUPPORTED'
    ) {
      return res.status(503).json({ success: false, error: error.message });
    }
    console.error('Chat message failed:', error.message);
    res.status(502).json({ success: false, error: 'The assistant could not respond. Please retry.' });
  }
});

module.exports = router;
