import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Users, ChevronDown, ChevronUp, Zap } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';
import ClarityRing from '../components/common/ClarityRing';
import ContributingFactorsLedger from '../components/predict/ContributingFactorsLedger';

const BAND_TONE = { low: 'teal', moderate: 'gold', high: 'red', critical: 'red' };
const PRIORITY_TONE = { low: 'teal', medium: 'gold', high: 'red', urgent: 'red' };

function TeacherRow({ teacher, isOpen, onToggle, prediction, loading, error, onRunAssessment }) {
  const result = prediction?.prediction;
  const rationale = prediction?.rationale;

  return (
    <Card className="mb-3">
      <Pressable className="flex-row items-center justify-between" onPress={onToggle}>
        <View className="flex-1 pr-3">
          <Text className="text-ink font-body-semibold">{teacher.full_name}</Text>
          <Text className="text-ink-faint text-xs mt-1">
            {teacher.years_experience ?? '—'} yrs · digital skills {teacher.digital_skills_score ?? '—'}/100 · uses AI tools {teacher.ai_tool_usage_frequency || 'unknown'}
          </Text>
        </View>
        {result && (
          <Badge tone={BAND_TONE[result.exposure_band] || 'neutral'} className="mr-2">
            {result.exposure_band}
          </Badge>
        )}
        {isOpen ? <ChevronUp color={colors.inkFaint} size={18} /> : <ChevronDown color={colors.inkFaint} size={18} />}
      </Pressable>

      {isOpen && (
        <View className="mt-4 pt-4 border-t border-border">
          {loading && (
            <View className="gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </View>
          )}

          {!!error && !loading && (
            <View className="gap-3">
              <Text className="text-red text-xs">{error}</Text>
              <Button variant="secondary" onPress={onRunAssessment}>Retry assessment</Button>
            </View>
          )}

          {!loading && !error && !result && (
            <Button onPress={onRunAssessment}>
              <Zap color={colors.bg} size={16} />
              <Text className="text-bg font-body-semibold">Run AI-disruption assessment</Text>
            </Button>
          )}

          {!loading && result && (
            <View className="gap-4">
              <View className="flex-row items-center gap-4">
                <ClarityRing mode="confidence" value={result.ai_disruption_exposure_score / 100} color={BAND_TONE[result.exposure_band] === 'red' ? 'red' : BAND_TONE[result.exposure_band] === 'gold' ? 'gold' : 'teal'} size={56} />
                <View className="flex-1">
                  <Text className="text-ink font-mono-semibold text-2xl">{Math.round(result.ai_disruption_exposure_score)}</Text>
                  <Text className="text-ink-muted text-xs">AI-disruption exposure score</Text>
                  <Badge tone={PRIORITY_TONE[result.reskilling_priority] || 'neutral'} className="mt-1">
                    {result.reskilling_priority} reskilling priority
                  </Badge>
                </View>
              </View>

              {!!result.recommended_actions?.length && (
                <View className="gap-1">
                  <Text className="text-ink-muted text-xs uppercase tracking-wide font-body-semibold mb-1">Recommended actions</Text>
                  {result.recommended_actions.map((action, i) => (
                    <Text key={i} className="text-ink-muted text-xs leading-relaxed">• {action}</Text>
                  ))}
                </View>
              )}

              <ContributingFactorsLedger contributingFactors={rationale?.contributing_factors} caveats={rationale?.caveats} />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

export default function RosterScreen() {
  const [teachers, setTeachers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [predictionsById, setPredictionsById] = useState({});
  const [assessing, setAssessing] = useState({});
  const [assessError, setAssessError] = useState({});

  const loadTeachers = useCallback(async () => {
    try {
      setListError(null);
      const { teachers: list } = await apiFetch('/teachers');
      setTeachers(list || []);
    } catch (error) {
      setListError(error.message);
    }
  }, []);

  useEffect(() => {
    setLoadingList(true);
    loadTeachers().finally(() => setLoadingList(false));
  }, [loadTeachers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTeachers();
    setRefreshing(false);
  }, [loadTeachers]);

  const runAssessment = useCallback(async (teacherId) => {
    setAssessing((prev) => ({ ...prev, [teacherId]: true }));
    setAssessError((prev) => ({ ...prev, [teacherId]: null }));
    try {
      const { prediction } = await apiFetch('/predict/teacher-roles', {
        method: 'POST',
        body: JSON.stringify({ teacherId }),
      });
      setPredictionsById((prev) => ({ ...prev, [teacherId]: prediction }));
    } catch (error) {
      setAssessError((prev) => ({ ...prev, [teacherId]: error.message }));
    } finally {
      setAssessing((prev) => ({ ...prev, [teacherId]: false }));
    }
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-bg pt-4 px-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
    >
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-ink-muted text-xs tracking-widest uppercase">Teacher Readiness</Text>
          <Text className="text-ink font-display text-2xl">Roster</Text>
        </View>
        <Users color={colors.teal} size={28} />
      </View>

      {loadingList && (
        <View className="gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </View>
      )}

      {!loadingList && !!listError && (
        <EmptyState
          icon={Users}
          title="Could not load the roster"
          description={listError}
          action={<Button variant="secondary" className="mt-2" onPress={loadTeachers}>Retry</Button>}
        />
      )}

      {!loadingList && !listError && teachers.length === 0 && (
        <EmptyState
          icon={Users}
          title="No teachers yet"
          description="Run the backend seed script to populate a demo roster, or add teachers via the API."
        />
      )}

      {!loadingList && !listError && teachers.map((teacher) => (
        <TeacherRow
          key={teacher.id}
          teacher={teacher}
          isOpen={openId === teacher.id}
          onToggle={() => setOpenId(openId === teacher.id ? null : teacher.id)}
          prediction={predictionsById[teacher.id]}
          loading={!!assessing[teacher.id]}
          error={assessError[teacher.id]}
          onRunAssessment={() => runAssessment(teacher.id)}
        />
      ))}

      <View className="h-8" />
    </ScrollView>
  );
}
