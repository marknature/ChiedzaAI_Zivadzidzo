import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';

const ALERT_TONE = { critical: 'red', high: 'red', medium: 'indigo' };

function safeNumber(value, fallback = '—') {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}` : fallback;
}

function taskLabel(taskType) {
  return {
    teacher_roles: 'Teacher Roles',
    curriculum_skills: 'Curriculum',
    learning_outcomes: 'Learning Outcomes',
  }[taskType] || 'Assessment';
}

function relativeDate(value) {
  if (!value) return 'No recent activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recent activity';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MetricCard({ icon: Icon, label, value, detail, tone = colors.teal, style }) {
  return (
    <Card style={style} className="min-h-[132px]">
      <View className="flex-row items-start justify-between">
        <Text className="text-ink-muted text-xs uppercase tracking-wide flex-1 pr-2">{label}</Text>
        <View className="w-8 h-8 rounded-lg bg-surface2 items-center justify-center">
          <Icon color={tone} size={16} />
        </View>
      </View>
      <Text className="text-ink font-mono-semibold text-3xl mt-4">{value}</Text>
      <Text className="text-ink-muted text-xs leading-relaxed mt-1">{detail}</Text>
    </Card>
  );
}

function DashboardSkeleton({ isWide }) {
  return (
    <View className="gap-4">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <View style={[styles.metricGrid, !isWide && styles.metricGridNarrow]}>
        <Skeleton className="h-32 flex-1 rounded-2xl" />
        <Skeleton className="h-32 flex-1 rounded-2xl" />
        <Skeleton className="h-32 flex-1 rounded-2xl" />
      </View>
      <Skeleton className="h-44 w-full rounded-2xl" />
    </View>
  );
}

export default function DashboardScreen({ navigation, profile }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadOverview = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      let institutionId = profile?.institution_id;
      if (!institutionId) {
        const me = await apiFetch('/auth/me');
        institutionId = me.profile?.institution_id;
      }
      if (!institutionId) throw new Error('Your account is awaiting institution assignment.');
      const result = await apiFetch(`/schools/${institutionId}/overview`);
      setOverview(result.overview || null);
    } catch (cause) {
      setError(cause.message || 'Could not load the school dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.institution_id]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const contentWidth = Math.min(Math.max(width - 32, 0), 1120);
  const readiness = overview?.schoolReadiness || {};
  const curriculum = overview?.latestCurriculumReadiness || {};
  const learning = overview?.learningOutcomesTrend || {};
  const riskDistribution = overview?.teacherRoleRiskDistribution || {};
  const activity = overview?.recentPredictionActivity || { byTask: [] };
  const hasData = Boolean((readiness.totalTeachers || 0) > 0 || (activity.total || 0) > 0);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOverview({ refresh: true })} tintColor={colors.teal} />}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
          <View className="flex-row items-start justify-between mb-6">
            <View className="flex-1 pr-4">
              <Text className="text-ink-muted text-xs uppercase tracking-widest">School intelligence</Text>
              <Text className="text-ink font-display text-2xl mt-1">{overview?.institution?.name || 'School dashboard'}</Text>
              {!!overview?.institution?.district && <Text className="text-ink-muted text-sm mt-1">{overview.institution.district}</Text>}
            </View>
            <View className="w-11 h-11 rounded-2xl bg-teal/10 items-center justify-center">
              <Building2 color={colors.teal} size={22} />
            </View>
          </View>

          {loading && !overview ? <DashboardSkeleton isWide={isWide} /> : null}

          {!!error && !overview && (
            <EmptyState
              icon={AlertTriangle}
              title="Could not load the school dashboard"
              description={error}
              action={<Button variant="secondary" className="mt-2" onPress={() => loadOverview()}>Try again</Button>}
            />
          )}

          {!!overview && (
            <View className="gap-4">
              {!!error && (
                <Card className="border-red/25">
                  <Text className="text-red text-sm">Showing your last loaded dashboard. {error}</Text>
                  <Button variant="secondary" className="mt-3 self-start" onPress={() => loadOverview()}>Retry</Button>
                </Card>
              )}

              <Card className="border-teal/25" style={styles.heroCard}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-ink-muted text-xs uppercase tracking-widest">School readiness</Text>
                    <Text className="text-ink font-display text-3xl mt-2">{safeNumber(readiness.assessmentCoveragePercent)}{readiness.assessmentCoveragePercent === null || readiness.assessmentCoveragePercent === undefined ? '' : '%'}</Text>
                    <Text className="text-ink-muted text-sm leading-relaxed mt-1">Assessment coverage across your institution’s roster.</Text>
                  </View>
                  <Badge tone={overview.dataScope === 'institution_aggregate_only' ? 'indigo' : 'teal'}>
                    {overview.dataScope === 'institution_aggregate_only' ? 'Aggregate only' : 'Institution view'}
                  </Badge>
                </View>
                <View className="mt-5 pt-4 border-t border-border flex-row flex-wrap">
                  <View className="mr-8 mb-2"><Text className="text-ink font-mono-semibold text-lg">{safeNumber(readiness.totalTeachers)}</Text><Text className="text-ink-faint text-xs">Rostered teachers</Text></View>
                  <View className="mr-8 mb-2"><Text className="text-ink font-mono-semibold text-lg">{safeNumber(readiness.averageDigitalReadiness)}</Text><Text className="text-ink-faint text-xs">Avg. digital readiness</Text></View>
                  <View className="mb-2"><Text className="text-ink font-mono-semibold text-lg">{safeNumber(readiness.highPriorityReskillingCount)}</Text><Text className="text-ink-faint text-xs">High-priority support</Text></View>
                </View>
              </Card>

              {overview.priorityAlerts?.length > 0 && (
                <View>
                  <Text className="text-ink font-body-semibold text-lg mb-3">Priority attention</Text>
                  <View style={[styles.alertGrid, !isWide && styles.alertGridNarrow]}>
                    {overview.priorityAlerts.slice(0, 3).map((alert) => (
                      <Card key={alert.type} style={isWide ? styles.alertCard : undefined} className="mb-3">
                        <View className="flex-row items-start">
                          <AlertTriangle color={ALERT_TONE[alert.severity] === 'red' ? colors.red : colors.indigo} size={18} />
                          <View className="flex-1 ml-3">
                            <Badge tone={ALERT_TONE[alert.severity] || 'indigo'}>{alert.severity}</Badge>
                            <Text className="text-ink font-body-semibold mt-2">{alert.title}</Text>
                            <Text className="text-ink-muted text-xs leading-relaxed mt-1">{alert.message}</Text>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                </View>
              )}

              {!overview.priorityAlerts?.length && hasData && (
                <Card className="border-indigo/25">
                  <Text className="text-ink font-body-semibold">No priority alerts right now</Text>
                  <Text className="text-ink-muted text-xs leading-relaxed mt-1">This reflects the available assessments—not a guarantee that every readiness gap is resolved.</Text>
                </Card>
              )}

              <View style={[styles.metricGrid, !isWide && styles.metricGridNarrow]}>
                <MetricCard
                  style={isWide ? styles.metricCard : undefined}
                  icon={Users}
                  label="Teacher roles"
                  value={safeNumber(riskDistribution.assessedTeachers)}
                  detail={`${safeNumber(riskDistribution.high, '0')} high · ${safeNumber(riskDistribution.critical, '0')} critical risk assessments`}
                />
                <MetricCard
                  style={isWide ? styles.metricCard : undefined}
                  icon={BookOpen}
                  tone={curriculum.readinessBand === 'high_obsolescence' ? colors.red : colors.indigo}
                  label="Curriculum readiness"
                  value={safeNumber(curriculum.readinessScore)}
                  detail={curriculum.available ? `${curriculum.readinessBand?.replace(/_/g, ' ') || 'Latest assessment'} · future skills ${safeNumber(curriculum.futureSkillsScore)}` : 'No curriculum assessment yet'}
                />
                <MetricCard
                  style={isWide ? styles.metricCard : undefined}
                  icon={TrendingUp}
                  label="Learning outcomes"
                  value={safeNumber(learning.averageResilienceScore)}
                  detail={`${safeNumber(learning.atRiskCount, '0')} at-risk or declining cohort assessments`}
                />
              </View>

              {!hasData && (
                <EmptyState
                  icon={ClipboardCheck}
                  title="Start with an assessment"
                  description="Run a curriculum, teacher-role, or aggregate learning-outcomes assessment to populate this leader dashboard."
                  action={<Button className="mt-2" onPress={() => navigation.navigate('Assess')}><Text className="text-bg font-body-semibold">Open Assess</Text><ArrowRight color={colors.bg} size={16} /></Button>}
                />
              )}

              <View style={[styles.detailsGrid, !isWide && styles.detailsGridNarrow]}>
                <Card style={isWide ? styles.detailCard : undefined}>
                  <View className="flex-row items-center mb-3"><BarChart3 color={colors.indigo} size={18} /><Text className="text-ink font-body-semibold ml-2">Teacher-risk distribution</Text></View>
                  <View className="flex-row flex-wrap gap-2">
                    {['low', 'moderate', 'high', 'critical'].map((band) => (
                      <Badge key={band} tone={band === 'low' ? 'teal' : band === 'moderate' ? 'indigo' : 'red'}>{band} {safeNumber(riskDistribution[band], '—')}</Badge>
                    ))}
                  </View>
                  <Text className="text-ink-faint text-xs leading-relaxed mt-4">Counts show the latest available teacher-role assessment for each rostered teacher.</Text>
                </Card>

                <Card style={isWide ? styles.detailCard : undefined}>
                  <View className="flex-row items-center mb-3"><TrendingUp color={colors.teal} size={18} /><Text className="text-ink font-body-semibold ml-2">What changed?</Text></View>
                  {activity.byTask?.length ? activity.byTask.map((entry) => (
                    <View key={entry.taskType} className="flex-row items-center justify-between py-2 border-b border-border">
                      <View><Text className="text-ink text-sm">{taskLabel(entry.taskType)}</Text><Text className="text-ink-faint text-xs mt-0.5">Latest {relativeDate(entry.latestAt)}</Text></View>
                      <Text className="text-ink font-mono-semibold">{entry.count}</Text>
                    </View>
                  )) : <Text className="text-ink-muted text-xs leading-relaxed">No assessment activity in the last {activity.windowDays || 30} days.</Text>}
                </Card>
              </View>

              <View className="bg-indigo/10 border border-indigo/25 rounded-2xl p-4 flex-row items-start">
                <AlertTriangle color={colors.indigo} size={17} />
                <Text className="text-ink-muted text-xs leading-relaxed ml-3 flex-1">ZivaDzidzo is LLM-reasoned decision support. Scores and contributing factors are associational, not causal proof, and this dashboard intentionally uses institution-level aggregates rather than learner records.</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', alignSelf: 'center' },
  heroCard: { minHeight: 180 },
  metricGrid: { flexDirection: 'row', gap: 12 },
  metricGridNarrow: { flexDirection: 'column' },
  metricCard: { flex: 1 },
  alertGrid: { flexDirection: 'row', gap: 12 },
  alertGridNarrow: { flexDirection: 'column' },
  alertCard: { flex: 1 },
  detailsGrid: { flexDirection: 'row', gap: 12 },
  detailsGridNarrow: { flexDirection: 'column' },
  detailCard: { flex: 1 },
});
