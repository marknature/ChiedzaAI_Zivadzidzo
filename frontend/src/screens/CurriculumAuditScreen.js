import React, { useEffect, useState } from 'react';
import { Text, View, ScrollView, TextInput, Alert, Modal, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { Shield, GraduationCap, Sparkles, CheckCircle2, AlertTriangle, CircleHelp, X, ChevronRight, BrainCircuit } from 'lucide-react-native';
import { colors } from '../theme/colors';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000';

// This is the original single-screen curriculum auditor (the "Curriculum Gap
// Auditor" / SRI flow from the Dev Report), moved unchanged into the Home tab of the
// navigation shell. It is the working demo path and must keep functioning exactly as
// before through the rest of the build - it becomes the curriculum_skills predict
// head in Phase 2, but /api/audit/analyze keeps serving it in the meantime.
export default function CurriculumAuditScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const contentWidth = Math.min(width - 32, 1120);
  const riskCardWidth = isWide ? (contentWidth - 12) / 2 : undefined;
  const [curriculumTitle, setCurriculumTitle] = useState('Computer Science Fundamentals');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);

  const [subjects, setSubjects] = useState([
    { name: 'Core Syntax & Basics', weight: 0.35, vulnerability: 0.85 },
    { name: 'Database Design', weight: 0.25, vulnerability: 0.40 },
    { name: 'Systems Architecture', weight: 0.40, vulnerability: 0.20 }
  ]);
  const [futureSkillsScore, setFutureSkillsScore] = useState(65);
  const [sriScore, setSriScore] = useState(68.5);
  const [auditSummary, setAuditSummary] = useState('Paste a syllabus to see the skills that will keep learners resilient in an AI-shaped world.');
  const [recommendations, setRecommendations] = useState([]);
  const [analysisMode, setAnalysisMode] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);

  const calculateLocalSRI = () => {
    let weightedNonVulnerability = 0;
    subjects.forEach(sub => {
      weightedNonVulnerability += sub.weight * (1 - sub.vulnerability);
    });

    const alpha = 0.8;
    const computed = (weightedNonVulnerability + alpha * (futureSkillsScore / 100)) * 100;
    setSriScore(parseFloat(computed.toFixed(1)));
  };

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/models/industry4/status`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active && payload?.success) setModelStatus(payload.model);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleAuditSubmission = async () => {
    if (!rawText.trim()) {
      Alert.alert("Missing Syllabus Data", "Please paste or type syllabus content to evaluate.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/audit/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: curriculumTitle,
          gradeLevel: "Tertiary Education",
          syllabusText: rawText,
          alpha: 0.8
        })
      });

      const result = await response.json();
      if (result.success) {
        const audit = result.audit;
        setSriScore(audit.readinessIndex);
        setFutureSkillsScore(audit.futureSkillsScore);
        setSubjects(audit.subjects);
        setAuditSummary(audit.summary);
        setRecommendations(audit.recommendations || []);
        setAnalysisMode(audit.analysisMode);
      } else {
        throw new Error(result.error || "Failed payload processing.");
      }
    } catch (err) {
      calculateLocalSRI();
      setAuditSummary('Offline simulator used. Start the ZivaDzidzo backend to receive curriculum-specific insight.');
      setRecommendations([
        'Add an applied project that asks learners to test and improve AI output.',
        'Assess evidence, judgement, and iteration—not recall alone.'
      ]);
      setAnalysisMode('offline');
      Alert.alert("Offline Simulator", "Used local calculation model engine.");
    } finally {
      setLoading(false);
    }
  };

  const sriTone = sriScore >= 70 ? 'teal' : sriScore >= 50 ? 'gold' : 'red';
  const sriLabel = sriScore >= 70 ? '▲ AI READY' : sriScore >= 50 ? '● MODERATE RISK' : '▼ HIGH OBSOLESCENCE';

  const scoreDrivers = (subject) => [
    {
      label: subject.vulnerability > 0.6 ? 'Automation vulnerability' : 'Applied learning resilience',
      detail: `${Math.round(subject.vulnerability * 100)}% vulnerability based on the curriculum’s current balance of knowledge and practical work.`
    },
    {
      label: 'Curriculum evidence',
      detail: subject.rationale || 'This area has not yet been analysed in detail; run an audit for a curriculum-specific explanation.'
    },
    {
      label: 'Future skills integration',
      detail: `${futureSkillsScore}% of the wider curriculum signals skills such as judgement, collaboration, and AI literacy.`
    }
  ];

  const nextMoveFor = (subject) => subject.modernization
    || (subject.vulnerability > 0.6
      ? 'Add a practical challenge where learners verify, critique, and improve AI output.'
      : 'Add an AI-assisted reflection and evidence-based assessment rubric.');

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={styles.scrollContent}>
      <View style={[styles.page, isWide && styles.pageWide]}>
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-ink-muted text-xs tracking-widest uppercase">ChiedzaAI Platform</Text>
          <Text className="text-ink font-display text-2xl">ZivaDzidzo</Text>
        </View>
        <GraduationCap color={colors.teal} size={28} />
      </View>

      <View style={isWide ? styles.topGrid : undefined}>
      <Card className="mb-6" style={isWide ? styles.topGridItem : undefined}>
        <Text className="text-ink-muted text-sm mb-1">Skills Obsolescence & Readiness Index (SRI)</Text>
        <View className="flex-row items-baseline mb-3">
          <Text className="text-ink font-mono-semibold text-5xl">{sriScore}%</Text>
          <Badge tone={sriTone} className="ml-2">{sriLabel}</Badge>
        </View>

        <Text className="text-ink-muted text-xs leading-relaxed">
          The SRI tracks the resilience of this curriculum against generative AI automation. Lower indices suggest subjects need immediate adaptive updates.
        </Text>
        <View className="mt-4 flex-row items-center">
          <Sparkles color={colors.indigo} size={15} />
          <Text className="text-indigo text-xs ml-2">
            Future skills integration: {futureSkillsScore}%{analysisMode ? ` · ${analysisMode === 'openai' ? 'OpenAI analysis' : 'demo-ready analysis'}` : ''}
          </Text>
        </View>
      </Card>

      <Card className="mb-6" style={isWide ? styles.topGridItem : undefined}>
        <Text className="text-ink font-body-semibold text-base mb-3">Auditor Pipeline Input</Text>

        <TextInput
          className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 mb-3"
          placeholder="Curriculum Title"
          placeholderTextColor={colors.inkFaint}
          value={curriculumTitle}
          onChangeText={setCurriculumTitle}
        />

        <TextInput
          className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 mb-4 h-28"
          placeholder="Paste Syllabus or Course Topics here..."
          placeholderTextColor={colors.inkFaint}
          multiline
          textAlignVertical="top"
          value={rawText}
          onChangeText={setRawText}
        />

        <Button onPress={handleAuditSubmission} loading={loading}>
          <Shield color={colors.bg} size={18} />
          <Text className="text-bg font-body-semibold text-center">Execute Chiedza AI Audit</Text>
        </Button>
      </Card>
      </View>

      {!!modelStatus && (
        <View className="bg-teal/10 border border-teal/25 rounded-2xl p-5 mb-6">
          <View className="flex-row items-start">
            <View className="w-9 h-9 rounded-xl bg-teal/20 items-center justify-center mr-3">
              <BrainCircuit color={colors.teal} size={19} />
            </View>
            <View className="flex-1">
              <Text className="text-ink font-body-semibold">Model evidence</Text>
              <Text className="text-ink-muted text-xs leading-relaxed mt-1">
                Industry 4.0 readiness benchmark · {modelStatus.trainedRows?.toLocaleString()} training records
              </Text>
              <View className="flex-row flex-wrap mt-3" style={styles.metricRow}>
                <Badge tone="teal">F1 {((modelStatus.readinessMetrics?.macro_f1 || 0) * 100).toFixed(1)}%</Badge>
                <Badge tone="indigo">Gap MAE {modelStatus.skillGapMetrics?.mae ?? '—'}</Badge>
              </View>
              <Text className="text-ink-faint text-xs leading-relaxed mt-3">
                External benchmark for aggregate curriculum planning—not an individual learner or school verdict.
              </Text>
            </View>
          </View>
        </View>
      )}

      {!!analysisMode && (
        <View className="bg-indigo/10 border border-indigo/25 rounded-2xl p-5 mb-6">
          <View className="flex-row items-center mb-2">
            <CircleHelp color={colors.indigo} size={18} />
            <Text className="text-ink font-body-semibold ml-2">What this means</Text>
          </View>
          <Text className="text-ink-muted text-sm leading-relaxed">{auditSummary}</Text>
        </View>
      )}

      <View className="mb-8">
        <Text className="text-ink font-body-semibold text-lg mb-1">Curriculum risk map</Text>
        <Text className="text-ink-faint text-xs mb-4">Tap into the story behind every score.</Text>
        <View style={isWide ? styles.riskGrid : undefined}>
        {subjects.map((sub, idx) => (
          <Pressable key={idx} style={isWide ? { width: riskCardWidth } : undefined} onPress={() => setSelectedSubject(sub)} accessibilityRole="button" accessibilityLabel={`Explain ${sub.name} score`}>
          <Card className="mb-3">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-4">
                <Text className="text-ink font-body-semibold">{sub.name}</Text>
                <Text className="text-ink-muted text-xs mt-1">Automation vulnerability: {Math.round(sub.vulnerability * 100)}%</Text>
              </View>
              <View className="flex-row items-center">
                {sub.vulnerability > 0.6 ? <AlertTriangle color={colors.gold} size={18} /> : <CheckCircle2 color={colors.teal} size={18} />}
                <ChevronRight color={colors.inkFaint} size={18} className="ml-1" />
              </View>
            </View>
            {!!sub.rationale && <Text className="text-ink-muted text-xs leading-relaxed mt-3">Why: {sub.rationale}</Text>}
            <Text className="text-indigo text-xs leading-relaxed mt-2">What changed this score? Tap to explain</Text>
          </Card>
          </Pressable>
        ))}
        </View>
      </View>

      {recommendations.length > 0 && (
        <View className="mb-12">
          <Text className="text-ink font-body-semibold text-lg mb-4">Recommended next moves</Text>
          {recommendations.map((recommendation, index) => (
            <Card key={index} className="mb-3 flex-row">
              <Text className="text-teal font-mono-medium mr-3">0{index + 1}</Text>
              <Text className="text-ink-muted text-sm leading-relaxed flex-1">{recommendation}</Text>
            </Card>
          ))}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={!!selectedSubject}
        onRequestClose={() => setSelectedSubject(null)}
      >
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setSelectedSubject(null)}>
          <Pressable className="bg-surface rounded-t-[28px] px-5 pt-3 pb-9" style={[styles.sheet, isWide && styles.sheetWide]} onPress={(event) => event.stopPropagation()}>
            <View className="w-10 h-1 rounded-full bg-border self-center mb-5" />
            <View className="flex-row items-start justify-between mb-1">
              <View className="flex-1 pr-4">
                <Text className="text-ink-faint text-xs uppercase tracking-widest">Score explanation</Text>
                <Text className="text-ink font-display text-xl mt-1">{selectedSubject?.name}</Text>
              </View>
              <Pressable onPress={() => setSelectedSubject(null)} className="p-2 -mr-2" accessibilityLabel="Close explanation">
                <X color={colors.inkMuted} size={20} />
              </Pressable>
            </View>
            <Text className="text-ink-muted text-sm mt-2 mb-5">Three signals shaped this score—not a judgement of teachers or learners.</Text>
            {selectedSubject && scoreDrivers(selectedSubject).map((driver, index) => (
              <View key={driver.label} className="flex-row mb-4">
                <View className="w-6 h-6 rounded-full bg-indigo/20 items-center justify-center mr-3">
                  <Text className="text-indigo font-mono-semibold text-xs">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-ink font-body-semibold text-sm">{driver.label}</Text>
                  <Text className="text-ink-muted text-xs leading-relaxed mt-1">{driver.detail}</Text>
                </View>
              </View>
            ))}
            {selectedSubject && (
              <View className="bg-indigo/15 rounded-2xl p-4 mt-1">
                <Text className="text-indigo font-body-semibold text-xs uppercase tracking-wide">Recommended next move</Text>
                <Text className="text-ink text-sm leading-relaxed mt-1">{nextMoveFor(selectedSubject)}</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  page: { width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 1120 },
  topGrid: { flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  topGridItem: { flex: 1 },
  riskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sheet: { width: '100%' },
  sheetWide: { width: 620, alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  metricRow: { gap: 8 },
});
