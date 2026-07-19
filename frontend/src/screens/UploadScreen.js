import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { UploadCloud } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { API_URL } from '../lib/api';
import { colors } from '../theme/colors';

export default function UploadScreen({ institutionId, onComplete }) {
  const [busy, setBusy] = useState(false); const [result, setResult] = useState(null);
  async function selectAndUpload() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true });
    if (picked.canceled) return;
    setBusy(true);
    try {
      const asset = picked.assets[0]; const form = new FormData(); form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'text/csv' });
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/schools/${institutionId}/import`, { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token || ''}` }, body: form });
      const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error || 'Import failed.');
      setResult(payload); onComplete?.();
    } catch (error) { Alert.alert('Roster import', error.message); } finally { setBusy(false); }
  }
  return <View className="mt-4 rounded-2xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}><Text className="text-base font-semibold" style={{ color: colors.ink }}>Import roster</Text><Text className="mt-1 text-xs" style={{ color: colors.inkMuted }}>CSV/XLSX columns: full_name, department_name, subject_name, grade_level, years_experience, ai_tool_usage_frequency, digital_skills_score, training_hours.</Text><Pressable onPress={selectAndUpload} disabled={busy} className="mt-3 flex-row items-center justify-center rounded-xl py-3" style={{ backgroundColor: colors.teal, opacity: busy ? 0.6 : 1 }}><UploadCloud size={18} color={colors.bg} /><Text className="ml-2 font-bold" style={{ color: colors.bg }}>{busy ? 'Importing…' : 'Choose CSV or XLSX'}</Text></Pressable>{result && <ScrollView className="mt-3"><Text style={{ color: colors.ink }}>{result.imported} imported · {result.rejected} rejected</Text>{result.errors.map((item) => <Text key={item.row} className="mt-1 text-xs" style={{ color: colors.red }}>Row {item.row}: {item.errors.join(', ')}</Text>)}</ScrollView>}</View>;
}
