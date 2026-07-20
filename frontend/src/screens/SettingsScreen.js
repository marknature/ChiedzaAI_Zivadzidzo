import React from 'react';
import { Alert, Linking, View, Text } from 'react-native';
import { Bell, Settings as SettingsIcon, ShieldAlert } from 'lucide-react-native';
import { colors } from '../theme/colors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

export default function SettingsScreen({ profile, userEmail }) {
  return (
    <View className="flex-1 bg-bg px-6 pt-8">
      <View className="w-full max-w-md self-center">
        <View className="items-center mb-8">
          <SettingsIcon color={colors.teal} size={32} />
          <Text className="text-ink font-display text-xl mt-3">Settings</Text>
        </View>

        <Card className="mb-4">
          <Text className="text-ink-muted text-xs uppercase tracking-widest mb-1">Signed in as</Text>
          <Text className="text-ink font-body-semibold">{userEmail || 'Unknown user'}</Text>
          {!!profile?.full_name && <Text className="text-ink-muted text-sm mt-2">{profile.full_name}</Text>}
          {!!profile?.role && <Text className="text-ink-faint text-xs mt-1">Role: {profile.role}</Text>}
        </Card>

        <View className="bg-indigo/10 border border-indigo/25 rounded-2xl p-5 mb-6 flex-row items-start">
          <ShieldAlert color={colors.indigo} size={18} />
          <Text className="text-ink-muted text-xs leading-relaxed ml-3 flex-1">
            Every ZivaDzidzo prediction is a GPT-4o structured-output completion, not a trained model, and its
            explanation is self-reported, not a mechanistic decomposition. See KNOWN_LIMITATIONS.md.
          </Text>
        </View>

        <Button variant="secondary" className="mb-4" onPress={() => Alert.alert('Known limitations', '• No trained model in v1: predictions are GPT-4o structured-output completions.\n\n• Explainability is self-reported by the LLM, not mechanistic proof.\n\n• Proxy/synthetic data only until a pilot agreement exists.\n\n• Determinism is best-effort.\n\n• Student-level data is out of scope by design.') }>
          <Text className="text-ink font-body-semibold">Read known limitations</Text>
        </Button>

        <Button variant="secondary" onPress={() => Linking.openSettings()}>
          <Bell color={colors.ink} size={16} />
          <Text className="text-ink font-body-semibold ml-2">Manage notification permissions</Text>
        </Button>
      </View>
    </View>
  );
}
