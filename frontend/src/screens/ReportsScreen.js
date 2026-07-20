import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';

const predictionPaths = [
  '/predict/teacher-roles',
  '/predict/learning-outcomes',
  '/predict/curriculum-skills',
];

export default function ReportsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [exportError, setExportError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      // A missing or temporarily unavailable prediction head should not hide the
      // report history returned by the other two heads.
      const results = await Promise.allSettled(predictionPaths.map((path) => apiFetch(path)));
      const available = results
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value.predictions || []);
      const failedCount = results.filter((result) => result.status === 'rejected').length;

      setPredictions(available);
      if (failedCount) {
        setLoadError(
          failedCount === predictionPaths.length
            ? 'We could not load report data. Check your connection and try again.'
            : 'Some prediction history could not be loaded. Showing the available reports.'
        );
      }
    } catch (cause) {
      // Promise.allSettled normally prevents this path; it remains as a safe
      // fallback in case the response-processing code itself fails.
      setLoadError(cause.message || 'We could not load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(predictionId, format) {
    setCreating(`${predictionId}-${format}`);
    setExportError(null);
    try {
      const result = await apiFetch(`/reports/prediction/${predictionId}`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      });
      if (!result.url) throw new Error('The report was created but its download link is unavailable. Please try again.');
      await Linking.openURL(result.url);
    } catch (cause) {
      setExportError(cause.message || 'The report could not be created. Please try again.');
    } finally {
      setCreating(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={styles.scrollContent} style={{ backgroundColor: colors.bg }}>
        <View style={[styles.page, isWide && styles.pageWide]}>
          <View className="flex-row items-center">
            <FileText color={colors.teal} size={25} />
            <Text className="ml-2 text-2xl font-bold" style={{ color: colors.ink }}>Executive Reports</Text>
          </View>
          <Text className="mt-2" style={{ color: colors.inkMuted }}>Export a score, its rationale, actions and caveat as Word or PDF.</Text>

          {loading && <ActivityIndicator className="mt-8" color={colors.teal} />}

          {!!loadError && (
            <View className="mt-4 rounded-xl border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.red }}>
              <Text style={{ color: colors.red }}>{loadError}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading reports"
                onPress={load}
                disabled={loading}
                className="mt-3 self-start rounded-lg px-3 py-2"
                style={{ backgroundColor: colors.surface2, opacity: loading ? 0.6 : 1 }}
              >
                <Text className="text-xs font-bold" style={{ color: colors.ink }}>Try again</Text>
              </Pressable>
            </View>
          )}

          {!!exportError && <Text className="mt-4" style={{ color: colors.red }}>{exportError}</Text>}

          {!loading && !predictions.length && !loadError && (
            <Text className="mt-8" style={{ color: colors.inkMuted }}>Run a prediction first to generate a report.</Text>
          )}

          <View style={isWide && styles.reportGrid}>
            {predictions.map((prediction) => (
              <View key={prediction.id} className="mt-4 rounded-2xl border p-4" style={[{ backgroundColor: colors.surface, borderColor: colors.border }, isWide && styles.reportCard]}>
                <Text className="font-semibold capitalize" style={{ color: colors.ink }}>{prediction.task_type.replace('_', ' ')}</Text>
                <Text className="mt-1 text-xs" style={{ color: colors.inkMuted }}>{new Date(prediction.created_at).toLocaleDateString()}</Text>
                <View className="mt-3 flex-row gap-2">
                  {['docx', 'pdf'].map((format) => (
                    <Pressable
                      key={format}
                      accessibilityRole="button"
                      accessibilityLabel={`Export ${prediction.task_type} as ${format.toUpperCase()}`}
                      onPress={() => create(prediction.id, format)}
                      disabled={Boolean(creating)}
                      className="rounded-lg px-3 py-2"
                      style={{ backgroundColor: colors.teal, opacity: creating ? 0.6 : 1 }}
                    >
                      <Text className="text-xs font-bold uppercase" style={{ color: colors.bg }}>
                        {creating === `${prediction.id}-${format}` ? 'Working…' : format}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 },
  page: { width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 1120 },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reportCard: { width: '48.8%' },
});
