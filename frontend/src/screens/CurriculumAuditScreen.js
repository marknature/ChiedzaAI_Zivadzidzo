import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, BookOpen, GraduationCap, Sparkles, TrendingUp } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import ClarityRing from '../components/common/ClarityRing';
import ContributingFactorsLedger from '../components/predict/ContributingFactorsLedger';

const SCORE_TONE = (score) => (score >= 70 ? 'teal' : score >= 50 ? 'indigo' : 'red');

function InputLabel({ children }) {
  return <Text className="text-ink-muted text-xs uppercase tracking-wide mb-2">{children}</Text>;
}

function ScoreHero({ score, band, detail, confidence }) {
  const rounded = typeof score === 'number' ? Math.round(score) : null;
  const tone = SCORE_TONE(score || 0);
  return (
    <Card className="border-indigo/25">
      <View className="flex-row items-center">
        <ClarityRing mode="confidence" value={Math.max(0, Math.min(1, (score || 0) / 100))} color={tone} size={72} strokeWidth={6} label={rounded === null ? '—' : `${rounded}`} />
        <View className="flex-1 ml-4">
          <Text className="text-ink-muted text-xs uppercase tracking-wide">Structured assessment</Text>
          <View className="flex-row items-center mt-1 flex-wrap gap-2">
            <Text className="text-ink font-mono-semibold text-3xl">{rounded === null ? '—' : rounded}</Text>
            {!!band && <Badge tone={tone}>{String(band).replace(/_/g, ' ')}</Badge>}
          </View>
          <Text className="text-ink-muted text-xs leading-relaxed mt-1">{detail}</Text>
          {typeof confidence === 'number' && <Text className="text-ink-faint text-[11px] mt-1">Model confidence: {Math.round(confidence * 100)}%</Text>}
        </View>
      </View>
    </Card>
  );
}

function SegmentButton({ active, children, onPress }) {
  return (
    <Button variant={active ? 'primary' : 'secondary'} className="flex-1 py-2" onPress={onPress}>
      <Text className={active ? 'text-bg text-xs font-body-semibold' : 'text-ink-muted text-xs font-body-semibold'}>{children}</Text>
    </Button>
  );
}

export default function CurriculumAuditScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [mode, setMode] = useState('curriculum');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [curriculumResult, setCurriculumResult] = useState(null);
  const [learningResult, setLearningResult] = useState(null);

  const [curriculumTitle, setCurriculumTitle] = useState('');
  const [curriculumGrade, setCurriculumGrade] = useState('');
  const [syllabusText, setSyllabusText] = useState('');

  const [subjectName, setSubjectName] = useState('');
  const [learningGrade, setLearningGrade] = useState('');
  const [cohortSize, setCohortSize] = useState('');
  const [aiExposure, setAiExposure] = useState('');
  const [deliveryContext, setDeliveryContext] = useState('');
  const [passRates, setPassRates] = useState(['', '', '']);

  const rateHistory = useMemo(() => passRates
    .map((value, index) => ({ value: value.trim(), index }))
    .filter(({ value }) => value.length > 0)
    .map(({ value, index }) => ({ period: `Assessment ${index + 1}`, passRatePercent: Number(value) })), [passRates]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError(null);
  }

  async function submitCurriculum() {
    if (syllabusText.trim().length < 12) {
      setError('Provide at least a short syllabus or course outline before running the assessment.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch('/predict/curriculum-skills', {
        method: 'POST',
        body: JSON.stringify({
          title: curriculumTitle.trim() || 'Untitled curriculum',
          gradeLevel: curriculumGrade.trim() || undefined,
          syllabusText: syllabusText.trim(),
          alpha: 0.8,
        }),
      });
      setCurriculumResult(result.prediction);
    } catch (cause) {
      setError(cause.message || 'The curriculum assessment could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  async function submitLearningOutcomes() {
    if (!subjectName.trim()) {
      setError('Provide a subject name for the aggregate cohort assessment.');
      return;
    }
    if (!rateHistory.length || rateHistory.some(({ passRatePercent }) => !Number.isFinite(passRatePercent) || passRatePercent < 0 || passRatePercent > 100)) {
      setError('Enter at least one cohort pass rate between 0 and 100. Do not enter individual learner results.');
      return;
    }
    const exposure = Number(aiExposure);
    if (!Number.isFinite(exposure) || exposure < 0 || exposure > 100) {
      setError('AI-tool exposure must be a number between 0 and 100.');
      return;
    }
    const parsedCohortSize = cohortSize.trim() ? Number(cohortSize) : undefined;
    if (parsedCohortSize !== undefined && (!Number.isInteger(parsedCohortSize) || parsedCohortSize < 1)) {
      setError('Cohort size must be a positive whole number when provided.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch('/predict/learning-outcomes', {
        method: 'POST',
        body: JSON.stringify({
          subjectName: subjectName.trim(),
          gradeLevel: learningGrade.trim() || undefined,
          cohortSize: parsedCohortSize,
          aiToolExposureLevel: exposure,
          curriculumDeliveryContext: deliveryContext.trim() || undefined,
          historicalPassRates: rateHistory,
        }),
      });
      setLearningResult(result.prediction);
    } catch (cause) {
      setError(cause.message || 'The Learning Outcomes assessment could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  const activeResult = mode === 'curriculum' ? curriculumResult : learningResult;
  const resultData = activeResult?.prediction || {};
  const resultRationale = activeResult?.rationale || {};
  const curriculumSubjects = Array.isArray(resultData.subjects) ? resultData.subjects : [];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, isWide && styles.pageWide]}>
          <View className="flex-row items-start justify-between mb-6">
            <View className="flex-1 pr-4">
              <Text className="text-ink-muted text-xs uppercase tracking-widest">Structured decision support</Text>
              <Text className="text-ink font-display text-2xl mt-1">Assess readiness</Text>
              <Text className="text-ink-muted text-sm leading-relaxed mt-2">Run a curriculum or cohort-level learning-outcomes assessment. Individual learner records are never accepted.</Text>
            </View>
            <View className="w-11 h-11 rounded-2xl bg-teal/10 items-center justify-center"><GraduationCap color={colors.teal} size={23} /></View>
          </View>

          <View className="flex-row gap-2 mb-5">
            <SegmentButton active={mode === 'curriculum'} onPress={() => switchMode('curriculum')}>Curriculum & skills</SegmentButton>
            <SegmentButton active={mode === 'learning'} onPress={() => switchMode('learning')}>Learning outcomes</SegmentButton>
          </View>

          {mode === 'curriculum' ? (
            <View style={isWide ? styles.topGrid : undefined}>
              <Card className="mb-5" style={isWide ? styles.topGridItem : undefined}>
                <View className="flex-row items-center mb-4"><BookOpen color={colors.indigo} size={19} /><Text className="text-ink font-body-semibold ml-2">Curriculum & Future Skills</Text></View>
                <InputLabel>Curriculum title</InputLabel>
                <TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 mb-4" placeholder="e.g. Form 3 Computer Science" placeholderTextColor={colors.inkFaint} value={curriculumTitle} onChangeText={setCurriculumTitle} />
                <InputLabel>Grade or level</InputLabel>
                <TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 mb-4" placeholder="e.g. Form 3" placeholderTextColor={colors.inkFaint} value={curriculumGrade} onChangeText={setCurriculumGrade} />
                <InputLabel>Syllabus or course outline</InputLabel>
                <TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 h-40" placeholder="Paste curriculum objectives, topics, assessment methods, and practical work…" placeholderTextColor={colors.inkFaint} multiline textAlignVertical="top" value={syllabusText} onChangeText={setSyllabusText} />
                <Button className="mt-4" onPress={submitCurriculum} loading={loading}>
                  <Sparkles color={colors.bg} size={17} />
                  <Text className="text-bg font-body-semibold">Run curriculum assessment</Text>
                </Button>
              </Card>

              <View style={isWide ? styles.topGridItem : undefined}>
                {curriculumResult ? (
                  <ScoreHero score={resultData.curriculum_readiness_score} band={resultData.readiness_band} confidence={activeResult.confidence} detail={`Future skills integration: ${Math.round(resultData.future_skills_score || 0)}%.`} />
                ) : (
                  <Card className="mb-5 border-indigo/25"><Text className="text-ink font-body-semibold">What you will receive</Text><Text className="text-ink-muted text-sm leading-relaxed mt-2">A server-calculated readiness score, subject-level vulnerability map, prioritized modernization actions, and clear caveats about the LLM-reasoned assessment.</Text></Card>
                )}
              </View>
            </View>
          ) : (
            <View style={isWide ? styles.topGrid : undefined}>
              <Card className="mb-5" style={isWide ? styles.topGridItem : undefined}>
                <View className="flex-row items-center mb-4"><TrendingUp color={colors.teal} size={19} /><Text className="text-ink font-body-semibold ml-2">Learning Outcomes</Text></View>
                <View className="bg-indigo/10 border border-indigo/25 rounded-xl p-3 mb-4"><Text className="text-indigo text-xs leading-relaxed">Use cohort-level aggregates only. Do not paste names, IDs, emails, or individual learner results.</Text></View>
                <InputLabel>Subject</InputLabel>
                <TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 mb-4" placeholder="e.g. Mathematics" placeholderTextColor={colors.inkFaint} value={subjectName} onChangeText={setSubjectName} />
                <InputLabel>Grade or level</InputLabel>
                <TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 mb-4" placeholder="e.g. Form 3" placeholderTextColor={colors.inkFaint} value={learningGrade} onChangeText={setLearningGrade} />
                <View style={styles.splitInputs}>
                  <View style={styles.splitInput}><InputLabel>Cohort size (optional)</InputLabel><TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3" placeholder="e.g. 42" placeholderTextColor={colors.inkFaint} keyboardType="numeric" value={cohortSize} onChangeText={setCohortSize} /></View>
                  <View style={styles.splitInput}><InputLabel>AI exposure (0–100)</InputLabel><TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3" placeholder="e.g. 35" placeholderTextColor={colors.inkFaint} keyboardType="numeric" value={aiExposure} onChangeText={setAiExposure} /></View>
                </View>
                <InputLabel>Aggregate pass rates (0–100)</InputLabel>
                <View style={styles.splitInputs}>
                  {passRates.map((rate, index) => <View key={index} style={styles.splitInput}><TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-3 py-3" placeholder={`#${index + 1}`} placeholderTextColor={colors.inkFaint} keyboardType="numeric" value={rate} onChangeText={(next) => setPassRates((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))} /></View>)}
                </View>
                <InputLabel>Teaching context (optional)</InputLabel>
                <TextInput className="bg-bg text-ink font-body border border-border rounded-xl px-4 py-3 h-24" placeholder="e.g. Teacher-guided lessons with limited connectivity and project work." placeholderTextColor={colors.inkFaint} multiline textAlignVertical="top" value={deliveryContext} onChangeText={setDeliveryContext} />
                <Button className="mt-4" onPress={submitLearningOutcomes} loading={loading}>
                  <TrendingUp color={colors.bg} size={17} />
                  <Text className="text-bg font-body-semibold">Run cohort assessment</Text>
                </Button>
              </Card>

              <View style={isWide ? styles.topGridItem : undefined}>
                {learningResult ? (
                  <ScoreHero score={resultData.pass_rate_resilience_score} band={resultData.trajectory_band} confidence={activeResult.confidence} detail="Pass-rate resilience as AI-tool exposure rises, based on aggregate cohort signals." />
                ) : (
                  <Card className="mb-5 border-teal/25"><Text className="text-ink font-body-semibold">Cohort-only by design</Text><Text className="text-ink-muted text-sm leading-relaxed mt-2">This assessment helps leaders notice aggregate trend risks. It does not model, score, store, or display individual learners.</Text></Card>
                )}
              </View>
            </View>
          )}

          {!!error && <View className="bg-red/10 border border-red/25 rounded-2xl p-4 flex-row items-start mb-5"><AlertTriangle color={colors.red} size={17} /><Text className="text-red text-xs leading-relaxed ml-3 flex-1">{error}</Text></View>}

          {!!activeResult && (
            <View className="gap-4 mb-6">
              {mode === 'curriculum' && (
                <View>
                  <Text className="text-ink font-body-semibold text-lg mb-3">Curriculum risk map</Text>
                  <View style={isWide ? styles.subjectGrid : undefined}>
                    {curriculumSubjects.map((subject, index) => (
                      <Card key={`${subject.name}-${index}`} className="mb-3" style={isWide ? styles.subjectCard : undefined}>
                        <View className="flex-row items-start justify-between"><Text className="text-ink font-body-semibold flex-1 pr-3">{subject.name}</Text><Badge tone={SCORE_TONE(100 - (subject.vulnerability || 0) * 100)}>{Math.round((subject.vulnerability || 0) * 100)}% vulnerable</Badge></View>
                        <Text className="text-ink-muted text-xs leading-relaxed mt-3">{subject.rationale}</Text>
                        <Text className="text-teal text-xs leading-relaxed mt-3">Next move: {subject.modernization}</Text>
                      </Card>
                    ))}
                  </View>
                </View>
              )}

              <Card>
                <Text className="text-ink font-body-semibold text-lg mb-3">Recommended next moves</Text>
                {resultData.recommended_actions?.map((action, index) => <View key={`${action}-${index}`} className="flex-row mb-3"><Text className="text-teal font-mono-semibold mr-3">0{index + 1}</Text><Text className="text-ink-muted text-sm leading-relaxed flex-1">{action}</Text></View>)}
              </Card>

              <Card>
                <Text className="text-ink font-body-semibold text-lg mb-4">Why this assessment</Text>
                <ContributingFactorsLedger contributingFactors={resultRationale.contributing_factors} caveats={resultRationale.caveats} />
              </Card>
            </View>
          )}

          <View className="bg-indigo/10 border border-indigo/25 rounded-2xl p-4 flex-row items-start mb-4"><AlertTriangle color={colors.indigo} size={17} /><Text className="text-ink-muted text-xs leading-relaxed ml-3 flex-1">These are structured LLM-reasoned decision-support outputs, not trained-model or causal claims. If the service cannot complete an assessment, ZivaDzidzo shows the error instead of fabricating a local fallback.</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 100 },
  page: { width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 1120 },
  topGrid: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  topGridItem: { flex: 1 },
  splitInputs: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  splitInput: { flex: 1 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subjectCard: { width: '48.8%' },
});
