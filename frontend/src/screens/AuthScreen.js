import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { GraduationCap, Mail, Lock } from 'lucide-react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { colors } from '../theme/colors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

// Membership is assigned by a trusted institution administrator or invite workflow.
// Sign-up creates an auth account only; it never selects a school or role client-side.
export default function AuthScreen() {
  const [mode, setMode] = useState('sign_in'); // 'sign_in' | 'sign_up' | 'magic_link'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <Text className="text-ink font-display-semibold text-lg mb-2 text-center">Supabase is not configured</Text>
        <Text className="text-ink-muted text-sm text-center" style={{ maxWidth: 360 }}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in frontend/.env to enable sign-in.
        </Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'magic_link') {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
        if (error) throw error;
        Alert.alert('Check your email', 'We sent you a magic sign-in link.');
        return;
      }

      if (!password) {
        Alert.alert('Missing password', 'Please enter your password.');
        return;
      }

      const { error } =
        mode === 'sign_up'
          ? await supabase.auth.signUp({ email: email.trim(), password })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) throw error;

      if (mode === 'sign_up') {
        Alert.alert('Account created', 'Check your email to confirm your account, then sign in.');
        setMode('sign_in');
      }
      // On successful sign-in, App.js's onAuthStateChange listener takes over
      // (session-sync + navigating into RootNavigator).
    } catch (error) {
      Alert.alert('Authentication error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <View className="flex-1 justify-center px-6">
        <View className="w-full self-center" style={{ maxWidth: 440 }}>
          <View className="items-center mb-10">
            <GraduationCap color={colors.teal} size={40} />
            <Text className="text-ink font-display text-2xl mt-3">ZivaDzidzo</Text>
            <Text className="text-ink-muted text-xs uppercase tracking-widest mt-1">ChiedzaAI Platform</Text>
          </View>

          <Card>
            <View className="flex-row items-center bg-bg border border-border rounded-xl px-4 mb-3">
              <Mail color={colors.inkFaint} size={16} />
              <TextInput
                className="flex-1 text-ink font-body px-3 py-3"
                placeholder="Email"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {mode !== 'magic_link' && (
              <View className="flex-row items-center bg-bg border border-border rounded-xl px-4 mb-4">
                <Lock color={colors.inkFaint} size={16} />
                <TextInput
                  className="flex-1 text-ink font-body px-3 py-3"
                  placeholder="Password"
                  placeholderTextColor={colors.inkFaint}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            )}

            <Button onPress={handleSubmit} loading={loading} className="mb-3">
              {mode === 'sign_in' ? 'Sign In' : mode === 'sign_up' ? 'Create Account' : 'Send Magic Link'}
            </Button>

            <View className="flex-row justify-center flex-wrap">
              <TouchableOpacity onPress={() => setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')}>
                <Text className="text-indigo text-xs">
                  {mode === 'sign_in' ? "Need an account? Sign up" : 'Have an account? Sign in'}
                </Text>
              </TouchableOpacity>
              <Text className="text-ink-faint text-xs mx-2">·</Text>
              <TouchableOpacity onPress={() => setMode(mode === 'magic_link' ? 'sign_in' : 'magic_link')}>
                <Text className="text-indigo text-xs">
                  {mode === 'magic_link' ? 'Use a password instead' : 'Use a magic link instead'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
