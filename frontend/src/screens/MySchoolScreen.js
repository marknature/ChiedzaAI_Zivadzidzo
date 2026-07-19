import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2, ChevronDown, ChevronRight, Users } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';
import UploadScreen from './UploadScreen';

function StaffMetric({ value, label }) {
  return <View className="mr-7 mb-2"><Text className="text-ink font-mono-semibold text-xl">{typeof value === 'number' ? Math.round(value) : '—'}</Text><Text className="text-ink-faint text-[11px]">{label}</Text></View>;
}

export default function MySchoolScreen({ profile }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [structure, setStructure] = useState([]);
  const [staffSummary, setStaffSummary] = useState(null);
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [institutionId, setInstitutionId] = useState(profile?.institution_id || null);
  const [role, setRole] = useState(profile?.role || null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      let nextInstitutionId = profile?.institution_id;
      let nextRole = profile?.role;
      if (!nextInstitutionId) {
        const me = await apiFetch('/auth/me');
        nextInstitutionId = me.profile?.institution_id;
        nextRole = me.profile?.role;
      }
      if (!nextInstitutionId) throw new Error('Your account is awaiting institution assignment.');
      const data = await apiFetch(`/schools/${nextInstitutionId}/structure`);
      setInstitutionId(nextInstitutionId);
      setRole(nextRole || null);
      setStructure(data.structure || []);
      setStaffSummary(data.staffSummary || null);
    } catch (cause) {
      setError(cause.message || 'Could not load the school structure.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.institution_id, profile?.role]);

  useEffect(() => { load(); }, [load]);

  const canImport = ['admin', 'head_teacher'].includes(role);
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={colors.teal} />}
      >
        <View style={[styles.page, isWide && styles.pageWide]}>
          <View className="flex-row items-start justify-between mb-6"><View><Text className="text-ink-muted text-xs uppercase tracking-widest">Institution structure</Text><Text className="text-ink font-display text-2xl mt-1">My School</Text><Text className="text-ink-muted text-sm mt-1">Departments, subjects, and aggregate staff readiness.</Text></View><View className="w-11 h-11 rounded-2xl bg-teal/10 items-center justify-center"><Building2 color={colors.teal} size={22} /></View></View>

          {loading && !structure.length ? <View className="gap-3"><Skeleton className="h-36 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></View> : null}
          {!!error && !structure.length && <EmptyState icon={Building2} title="Could not load My School" description={error} action={<Button variant="secondary" className="mt-2" onPress={() => load()}>Try again</Button>} />}

          {(!!structure.length || !!staffSummary) && (
            <View className="gap-4">
              {!!error && <Card className="border-red/25"><Text className="text-red text-xs">Showing the last loaded school structure. {error}</Text><Button variant="secondary" className="mt-3 self-start" onPress={() => load()}>Retry</Button></Card>}
              {!!staffSummary && <Card className="border-teal/25"><View className="flex-row items-center mb-3"><Users color={colors.teal} size={18} /><Text className="text-ink font-body-semibold ml-2">Staff overview</Text></View><View className="flex-row flex-wrap"><StaffMetric value={staffSummary.totalTeachers} label="Rostered" /><StaffMetric value={staffSummary.assignedTeachers} label="Subject assigned" /><StaffMetric value={staffSummary.assessedTeachers} label="Assessed" /><StaffMetric value={staffSummary.averageDigitalReadiness} label="Avg. readiness" /><StaffMetric value={staffSummary.highPriorityReskillingCount} label="High priority" /></View></Card>}

              <View>
                <Text className="text-ink font-body-semibold text-lg mb-3">Departments</Text>
                <View style={isWide ? styles.departmentGrid : undefined}>
                  {structure.map((department) => (
                    <Card key={department.id} className="mb-3" style={isWide ? styles.departmentCard : undefined}>
                      <Pressable className="flex-row items-center justify-between" onPress={() => setOpen((value) => ({ ...value, [department.id]: !value[department.id] }))} accessibilityRole="button" accessibilityLabel={`Show ${department.name} subjects`}>
                        <View className="flex-1 pr-3"><Text className="text-ink font-body-semibold">{department.name}</Text><Text className="text-ink-muted text-xs mt-1">{department.metrics?.staffCount ?? 0} staff · {department.metrics?.subjectCount ?? department.subjects?.length ?? 0} subjects · {department.metrics?.assessedStaffCount ?? 0} assessed</Text></View>
                        {open[department.id] ? <ChevronDown color={colors.teal} size={19} /> : <ChevronRight color={colors.inkMuted} size={19} />}
                      </Pressable>
                      {open[department.id] && <View className="mt-4 pt-3 border-t border-border">{department.subjects?.length ? department.subjects.map((subject) => <View key={subject.id} className="py-2"><Text className="text-ink text-sm">{subject.name}</Text><Text className="text-ink-faint text-xs mt-0.5">{subject.grade_level || 'All grades'}</Text></View>) : <Text className="text-ink-faint text-xs">No subjects yet.</Text>}<Text className="text-ink-faint text-[11px] leading-relaxed mt-3">Average digital readiness: {typeof department.metrics?.averageDigitalReadiness === 'number' ? Math.round(department.metrics.averageDigitalReadiness) : '—'} · high-priority support: {department.metrics?.highPriorityReskillingCount ?? '—'}</Text></View>}
                    </Card>
                  ))}
                </View>
              </View>

              {!structure.length && <EmptyState icon={Building2} title="No departments yet" description="Import a validated roster to create department and subject mappings." />}
              {canImport && institutionId ? <UploadScreen institutionId={institutionId} onComplete={() => load({ refresh: true })} /> : <Card><Text className="text-ink-muted text-xs leading-relaxed">Roster imports are available to institution administrators and head teachers. Your current role can still view aggregate school structure.</Text></Card>}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 1120 },
  departmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  departmentCard: { width: '48.8%' },
});
