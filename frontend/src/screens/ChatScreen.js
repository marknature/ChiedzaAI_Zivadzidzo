import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { MessageCircle, Send, Plus, Wrench } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';

const SUGGESTIONS = [
  'Which teachers need reskilling support most urgently?',
  'Audit this syllabus for AI-obsolescence risk',
  'What have we predicted so far this month?',
];

const markdownStyles = {
  body: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  strong: { fontFamily: 'Inter_700Bold', color: colors.ink },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { marginVertical: 1 },
  link: { color: colors.indigo },
  code_inline: { backgroundColor: colors.surface2, color: colors.teal, fontFamily: 'IBMPlexMono_400Regular', fontSize: 12, borderRadius: 4, paddingHorizontal: 4 },
  code_block: { backgroundColor: colors.surface2, color: colors.ink, fontFamily: 'IBMPlexMono_400Regular', fontSize: 12, borderRadius: 8, padding: 10 },
  fence: { backgroundColor: colors.surface2, color: colors.ink, fontFamily: 'IBMPlexMono_400Regular', fontSize: 12, borderRadius: 8, padding: 10 },
  heading1: { color: colors.ink, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, marginVertical: 4 },
  heading2: { color: colors.ink, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, marginVertical: 4 },
  heading3: { color: colors.ink, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, marginVertical: 3 },
  blockquote: { backgroundColor: colors.surface2, borderLeftColor: colors.indigo, borderLeftWidth: 3, paddingHorizontal: 10, paddingVertical: 4 },
};

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <View className={`mb-3 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View className={`rounded-2xl px-4 py-3 ${isUser ? 'bg-teal' : 'bg-surface border border-border'}`}>
        {isUser ? (
          <Text className="text-bg font-body">{message.content}</Text>
        ) : (
          <Markdown style={markdownStyles}>{message.content || ''}</Markdown>
        )}
      </View>
      {!isUser && message.toolCallLog?.length > 0 && (
        <View className="flex-row items-center mt-1 ml-1">
          <Wrench color={colors.inkFaint} size={11} />
          <Text className="text-ink-faint text-[10px] ml-1">
            Used: {message.toolCallLog.map((t) => t.name).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const loadSession = useCallback(async () => {
    try {
      const { session, messages: history } = await apiFetch('/chat/session');
      setSessionId(session.id);
      setMessages(
        history
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
          .map((m) => ({ role: m.role, content: m.content }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const startNewChat = useCallback(async () => {
    setLoadingSession(true);
    try {
      const { session } = await apiFetch('/chat/session/new', { method: 'POST', body: JSON.stringify({}) });
      setSessionId(session.id);
      setMessages([]);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setSending(true);
    try {
      const { sessionId: returnedSessionId, reply, toolCallLog } = await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ sessionId, content: trimmed }),
      });
      setSessionId(returnedSessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, toolCallLog }]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [sessionId, sending]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <View className="pt-4 px-4 pb-3 flex-row items-center justify-between border-b border-border">
        <View className="flex-row items-center">
          <MessageCircle color={colors.teal} size={22} />
          <Text className="text-ink font-display text-lg ml-2">ZivaDzidzo Assistant</Text>
        </View>
        <Button variant="secondary" onPress={startNewChat} className="px-3 py-2">
          <Plus color={colors.ink} size={14} />
          <Text className="text-ink text-xs font-body-semibold">New chat</Text>
        </Button>
      </View>

      {loadingSession ? (
        <View className="flex-1 px-4 pt-4 gap-3">
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
          <Skeleton className="h-12 w-1/2 rounded-2xl self-end" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 pt-4"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View className="items-center mt-10 px-6">
              <MessageCircle color={colors.inkFaint} size={32} />
              <Text className="text-ink-muted text-sm text-center mt-3">
                Ask about teacher readiness, curriculum risk, or learning-outcome trends. I can look up your roster
                and run real predictions - I never guess a score myself.
              </Text>
              <View className="mt-4 gap-2 w-full">
                {SUGGESTIONS.map((suggestion) => (
                  <Button key={suggestion} variant="secondary" onPress={() => sendMessage(suggestion)}>
                    <Text className="text-ink-muted text-xs text-center">{suggestion}</Text>
                  </Button>
                ))}
              </View>
            </View>
          )}

          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}

          {sending && (
            <View className="self-start bg-surface border border-border rounded-2xl px-4 py-3 mb-3">
              <ActivityIndicator color={colors.teal} size="small" />
            </View>
          )}
        </ScrollView>
      )}

      {!!error && (
        <Text className="text-red text-xs px-4 pb-1">{error}</Text>
      )}

      <View className="flex-row items-center px-4 py-3 border-t border-border">
        <TextInput
          className="flex-1 bg-surface text-ink font-body border border-border rounded-xl px-4 py-3 mr-2"
          placeholder="Message the assistant..."
          placeholderTextColor={colors.inkFaint}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
        />
        <Button onPress={() => sendMessage(input)} disabled={sending || !input.trim()} className="px-4 py-3">
          <Send color={colors.bg} size={18} />
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
