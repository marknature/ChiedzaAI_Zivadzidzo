import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Download, FileCheck2, UploadCloud } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { API_URL } from '../lib/api';
import { colors } from '../theme/colors';
import Button from '../components/common/Button';

function buildForm(asset, confirm = false) {
  const form = new FormData();
  form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'text/csv' });
  if (confirm) form.append('confirm', 'true');
  return form;
}

export default function UploadScreen({ institutionId, onComplete }) {
  const [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  async function requestUpload(path, file, confirm = false) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`${API_URL}/schools/${institutionId}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: buildForm(file, confirm),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      const error = new Error(payload.error || 'Import failed.');
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function selectAndPreview() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const nextAsset = picked.assets[0];
    setBusy(true);
    setAsset(nextAsset);
    setPreview(null);
    setResult(null);
    try {
      const payload = await requestUpload('/import/preview', nextAsset);
      setPreview(payload);
    } catch (error) {
      setPreview(error.payload || null);
      Alert.alert('Roster preview', error.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!asset || !preview?.canImport) return;
    setBusy(true);
    try {
      const payload = await requestUpload('/import', asset, true);
      setResult(payload);
      setPreview(null);
      onComplete?.();
    } catch (error) {
      setPreview(error.payload || preview);
      Alert.alert('Roster import', error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="mt-5 rounded-2xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3"><Text className="text-ink font-body-semibold text-base">Import roster</Text><Text className="text-ink-muted mt-1 text-xs leading-relaxed">Preview a CSV or XLSX first. The entire file is validated before one atomic save.</Text></View>
        <FileCheck2 size={19} color={colors.teal} />
      </View>

      <Pressable className="self-start flex-row items-center mt-3" onPress={() => Linking.openURL(`${API_URL}/schools/roster-template.csv`)}>
        <Download size={14} color={colors.indigo} />
        <Text className="text-indigo text-xs font-body-semibold ml-2">Download CSV template</Text>
      </Pressable>
      <Text className="text-ink-faint mt-2 text-[11px] leading-relaxed">Required: full_name. For mapped staff, supply department_name and subject_name together. Optional: grade_level, years_experience, AI-use frequency, digital skills, training hours, last_assessment_date.</Text>

      <Button className="mt-4" onPress={selectAndPreview} loading={busy}>
        <UploadCloud size={17} color={colors.bg} />
        <Text className="text-bg font-body-semibold">{asset ? 'Choose another file' : 'Choose file to preview'}</Text>
      </Button>

      {!!preview && (
        <View className="mt-4 border-t border-border pt-4">
          <Text className="text-ink font-body-semibold">Preview: {asset?.name || 'Selected file'}</Text>
          <Text className={`mt-1 text-sm ${preview.canImport ? 'text-teal' : 'text-red'}`}>{preview.valid || 0} valid · {preview.rejected || 0} need attention</Text>
          {!!preview.warnings?.length && preview.warnings.map((warning) => <Text key={warning.code} className="mt-2 text-xs leading-relaxed text-indigo">Note: {warning.message}</Text>)}
          {!!preview.errors?.length && <ScrollView className="mt-3 max-h-36">{preview.errors.map((item) => <Text key={item.row} className="mb-1 text-xs leading-relaxed text-red">Row {item.row}: {item.errors.join(', ')}</Text>)}</ScrollView>}
          {preview.canImport ? (
            <Button className="mt-4" onPress={confirmImport} loading={busy}>
              <FileCheck2 size={17} color={colors.bg} />
              <Text className="text-bg font-body-semibold">Confirm and import {preview.valid} row{preview.valid === 1 ? '' : 's'}</Text>
            </Button>
          ) : <Text className="mt-3 text-ink-faint text-xs leading-relaxed">Fix all errors and preview the corrected file before importing. No rows have been saved.</Text>}
        </View>
      )}

      {!!result && <View className="mt-4 bg-teal/10 border border-teal/25 rounded-xl p-3"><Text className="text-teal font-body-semibold text-sm">Imported {result.imported} row{result.imported === 1 ? '' : 's'} atomically.</Text><Text className="text-ink-muted text-xs leading-relaxed mt-1">The roster and its department/subject mappings were saved together.</Text></View>}
    </View>
  );
}
