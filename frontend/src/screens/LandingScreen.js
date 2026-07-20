import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react-native';
import { colors } from '../theme/colors';

const LIGHT_SURFACE = '#F7FAF9';
const LIGHT_INK = '#25272C';

function ActionButton({ children, onPress, variant = 'primary', compact = false, accessibilityLabel }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || String(children)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        styles[`actionButton${variant[0].toUpperCase()}${variant.slice(1)}`],
        compact && styles.actionButtonCompact,
        pressed && styles.actionButtonPressed,
      ]}
    >
      <Text style={[styles.actionButtonText, styles[`actionButtonText${variant[0].toUpperCase()}${variant.slice(1)}`]]}>
        {children}
      </Text>
      {variant === 'primary' && <ArrowRight color={colors.graphite} size={17} strokeWidth={2.4} />}
    </Pressable>
  );
}

function FeatureCard({ icon: Icon, eyebrow, title, children, isWide }) {
  return (
    <View style={[styles.featureCard, isWide && styles.featureCardWide]}>
      <View style={styles.featureIcon}>
        <Icon color={colors.deepTeal} size={20} strokeWidth={2.25} />
      </View>
      <Text style={styles.featureEyebrow}>{eyebrow}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{children}</Text>
    </View>
  );
}

function MockDashboard({ isCompact }) {
  return (
    <View style={[styles.dashboardCard, isCompact && styles.dashboardCardCompact]}>
      <View style={styles.dashboardTopRow}>
        <View>
          <Text style={styles.dashboardEyebrow}>SCHOOL READINESS</Text>
          <Text style={styles.dashboardTitle}>Northstar Academy</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveChipText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.scoreBlock}>
        <View>
          <Text style={styles.scoreLabel}>Readiness index</Text>
          <Text style={styles.scoreValue}>74<Text style={styles.scoreSuffix}>/100</Text></Text>
          <Text style={styles.scoreSupporting}>On track, with focus areas</Text>
        </View>
        <View style={styles.scoreRingOuter}>
          <View style={styles.scoreRingInner}>
            <Target color={colors.skyMint} size={25} strokeWidth={2.1} />
          </View>
        </View>
      </View>

      <View style={styles.dashboardDivider} />

      <View style={styles.dashboardInsight}>
        <View style={styles.insightIcon}>
          <Sparkles color={colors.graphite} size={16} strokeWidth={2.3} />
        </View>
        <View style={styles.insightCopy}>
          <Text style={styles.insightLabel}>NEXT BEST STEP</Text>
          <Text style={styles.insightText}>Modernise Year 10 Computing</Text>
        </View>
        <ArrowRight color="#B8F7E4" size={18} strokeWidth={2.2} />
      </View>

      <View style={styles.signalRow}>
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>12</Text>
          <Text style={styles.signalLabel}>Signals reviewed</Text>
        </View>
        <View style={styles.signalDivider} />
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>3</Text>
          <Text style={styles.signalLabel}>Priority actions</Text>
        </View>
      </View>
    </View>
  );
}

export default function LandingScreen({ onOpenAuth }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 900;
  const isTablet = width >= 620 && width < 900;
  const isCompact = width < 390;
  const isNarrowHeader = width < 560;
  const [reduceMotion, setReduceMotion] = useState(false);
  const intro = useRef(new Animated.Value(0)).current;
  const dashboardBob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => mounted && setReduceMotion(enabled))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    intro.stopAnimation();
    if (reduceMotion) {
      intro.setValue(1);
      return undefined;
    }
    intro.setValue(0);
    const animation = Animated.timing(intro, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [intro, reduceMotion]);

  useEffect(() => {
    dashboardBob.stopAnimation();
    if (reduceMotion) {
      dashboardBob.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(dashboardBob, { toValue: -7, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(dashboardBob, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [dashboardBob, reduceMotion]);

  const heroTranslateY = intro.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const heroOpacity = intro;

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.mintOrbTop} />
      <View pointerEvents="none" style={styles.mintOrbBottom} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.page, isWide && styles.pageWide, isCompact && styles.pageCompact, { paddingTop: (isWide ? styles.pageWide.paddingTop : isCompact ? styles.pageCompact.paddingTop : styles.page.paddingTop) + insets.top }]}>
          <Animated.View style={[styles.header, isNarrowHeader && styles.headerNarrow, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <GraduationCap color={colors.graphite} size={24} strokeWidth={2.25} />
              </View>
              <View>
                <Text style={styles.brandName}>ZivaDzidzo</Text>
                <Text style={styles.brandDescriptor}>CHIEDZAAI · EDUCATION INTELLIGENCE</Text>
              </View>
            </View>
            {!isNarrowHeader && (
              <View style={styles.headerActions}>
                {isWide && <Text style={styles.headerLabel}>For school leaders</Text>}
                <ActionButton compact variant="quiet" onPress={() => onOpenAuth('sign_in')}>Sign in</ActionButton>
                <ActionButton compact onPress={() => onOpenAuth('sign_up')}>Create account</ActionButton>
              </View>
            )}
          </Animated.View>

          <Animated.View style={[styles.hero, isWide && styles.heroWide, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
            <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
              <View style={styles.eyebrowPill}>
                <Sparkles color={colors.skyMint} size={14} strokeWidth={2.4} />
                <Text style={styles.eyebrowText}>EDUCATION INTELLIGENCE, MADE PRACTICAL</Text>
              </View>
              <Text style={[styles.heroTitle, isWide && styles.heroTitleWide, isCompact && styles.heroTitleCompact]}>
                See what your school needs next.
              </Text>
              <Text style={[styles.heroDescription, isWide && styles.heroDescriptionWide]}>
                ZivaDzidzo turns approved curriculum, staffing, and cohort evidence into clear, explainable actions for school leaders.
              </Text>
              <View style={[styles.heroActions, isTablet && styles.heroActionsTablet]}>
                <ActionButton onPress={() => onOpenAuth('sign_up')} accessibilityLabel="Create a ZivaDzidzo account">
                  Get started
                </ActionButton>
                <ActionButton variant="secondary" onPress={() => onOpenAuth('sign_in')}>
                  I already have an account
                </ActionButton>
              </View>
              <View style={styles.trustLine}>
                <ShieldCheck color={colors.skyMint} size={18} strokeWidth={2.25} />
                <Text style={styles.trustLineText}>Aggregate insights. Secure institutional access. Human decisions stay human.</Text>
              </View>
            </View>

            <Animated.View style={[styles.dashboardWrap, isWide && styles.dashboardWrapWide, { transform: [{ translateY: dashboardBob }] }]}>
              <View pointerEvents="none" style={styles.dashboardHalo} />
              <MockDashboard isCompact={isCompact} />
            </Animated.View>
          </Animated.View>

          <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
            <FeatureCard isWide={isWide} icon={BarChart3} eyebrow="CLEAR SIGNALS" title="A shared picture of readiness">
              Bring curriculum, role, and learning-outcome signals into one leader view.
            </FeatureCard>
            <FeatureCard isWide={isWide} icon={BrainCircuit} eyebrow="EXPLAINABLE AI" title="Recommendations you can review">
              Every assessment pairs a score with contributing factors, caveats, and next steps.
            </FeatureCard>
            <FeatureCard isWide={isWide} icon={ShieldCheck} eyebrow="BUILT FOR TRUST" title="School data stays in context">
              Institution membership is verified before private information is opened.
            </FeatureCard>
          </View>

          <View style={[styles.bottomCallout, isWide && styles.bottomCalloutWide]}>
            <View style={styles.bottomCalloutCopy}>
              <Text style={styles.bottomCalloutEyebrow}>READY WHEN YOU ARE</Text>
              <Text style={styles.bottomCalloutTitle}>Start with a clearer view of your school.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => onOpenAuth('sign_up')} style={({ pressed }) => [styles.bottomCalloutButton, isWide && styles.bottomCalloutButtonWide, pressed && styles.actionButtonPressed]}>
              <Check color={colors.graphite} size={18} strokeWidth={2.6} />
              <Text style={styles.bottomCalloutButtonText}>Create account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.graphite,
    overflow: 'hidden',
  },
  mintOrbTop: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: colors.skyMint,
    opacity: 0.08,
    top: -300,
    right: -200,
  },
  mintOrbBottom: {
    position: 'absolute',
    width: 440,
    height: 440,
    borderRadius: 220,
    borderColor: colors.skyMint,
    borderWidth: 1,
    opacity: 0.12,
    bottom: -260,
    left: -210,
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 34,
  },
  pageWide: {
    paddingHorizontal: 44,
    paddingTop: 32,
    paddingBottom: 52,
  },
  pageCompact: {
    paddingHorizontal: 15,
    paddingTop: 17,
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerNarrow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skyMint,
    marginRight: 11,
  },
  brandName: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    letterSpacing: -0.55,
  },
  brandDescriptor: {
    color: '#BFCBC6',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    letterSpacing: 0.95,
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  headerActionsNarrow: {
    alignSelf: 'flex-start',
    marginLeft: 0,
    marginTop: 14,
  },
  headerLabel: {
    color: '#C9D4D0',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginRight: 20,
  },
  actionButton: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonCompact: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginLeft: 5,
  },
  actionButtonPrimary: {
    backgroundColor: colors.skyMint,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderColor: '#596660',
    borderWidth: 1,
  },
  actionButtonQuiet: {
    backgroundColor: 'transparent',
  },
  actionButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  actionButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  actionButtonTextPrimary: {
    color: colors.graphite,
  },
  actionButtonTextSecondary: {
    color: LIGHT_SURFACE,
  },
  actionButtonTextQuiet: {
    color: '#D6E1DC',
  },
  hero: {
    marginTop: 52,
  },
  heroWide: {
    minHeight: 485,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 74,
  },
  heroCopy: {
    width: '100%',
  },
  heroCopyWide: {
    width: '54%',
    paddingRight: 32,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#50655D',
    backgroundColor: '#2E3835',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrowText: {
    color: colors.skyMint,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 43,
    lineHeight: 48,
    letterSpacing: -1.65,
    marginTop: 19,
    maxWidth: 580,
  },
  heroTitleWide: {
    fontSize: 60,
    lineHeight: 65,
    letterSpacing: -2.8,
  },
  heroTitleCompact: {
    fontSize: 37,
    lineHeight: 42,
    letterSpacing: -1.25,
  },
  heroDescription: {
    color: '#CDD8D3',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 580,
  },
  heroDescriptionWide: {
    fontSize: 16,
    lineHeight: 26,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 27,
  },
  heroActionsTablet: {
    marginTop: 22,
  },
  trustLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 23,
    maxWidth: 530,
  },
  trustLineText: {
    flex: 1,
    color: '#AEBBB5',
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
  },
  dashboardWrap: {
    width: '100%',
    marginTop: 45,
    position: 'relative',
  },
  dashboardWrapWide: {
    width: '42%',
    marginTop: 0,
  },
  dashboardHalo: {
    position: 'absolute',
    width: '92%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: colors.skyMint,
    opacity: 0.1,
    top: -25,
    right: -18,
  },
  dashboardCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#30383A',
    borderRadius: 25,
    borderColor: '#64746E',
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 17 },
    elevation: 8,
  },
  dashboardCardCompact: {
    padding: 18,
    borderRadius: 21,
  },
  dashboardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dashboardEyebrow: {
    color: '#AFC0B8',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.05,
  },
  dashboardTitle: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    letterSpacing: -0.4,
    marginTop: 5,
  },
  liveChip: {
    minHeight: 25,
    borderRadius: 14,
    backgroundColor: '#27443A',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.skyMint,
    marginRight: 6,
  },
  liveChipText: {
    color: colors.skyMint,
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.55,
  },
  scoreBlock: {
    minHeight: 126,
    borderRadius: 18,
    backgroundColor: '#252E2F',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 17,
    marginTop: 21,
  },
  scoreLabel: {
    color: '#B7C6C0',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  scoreValue: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 42,
    letterSpacing: -1.8,
    lineHeight: 47,
    marginTop: 3,
  },
  scoreSuffix: {
    color: '#9EAEA7',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0,
  },
  scoreSupporting: {
    color: colors.skyMint,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  scoreRingOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 7,
    borderColor: '#5B6A64',
    borderTopColor: colors.skyMint,
    borderRightColor: colors.skyMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingInner: {
    width: 49,
    height: 49,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#33423D',
  },
  dashboardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#52615B',
    marginVertical: 18,
  },
  dashboardInsight: {
    minHeight: 55,
    borderRadius: 14,
    backgroundColor: '#3C4B45',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightIcon: {
    width: 33,
    height: 33,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skyMint,
    marginRight: 10,
  },
  insightCopy: {
    flex: 1,
  },
  insightLabel: {
    color: '#B8F7E4',
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 0.8,
  },
  insightText: {
    color: LIGHT_SURFACE,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 3,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  signalItem: {
    flex: 1,
  },
  signalDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#52615B',
    marginHorizontal: 15,
  },
  signalValue: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 19,
  },
  signalLabel: {
    color: '#AFC0B8',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 2,
  },
  featureGrid: {
    marginTop: 56,
    gap: 12,
  },
  featureGridWide: {
    flexDirection: 'row',
    marginTop: 78,
    gap: 16,
  },
  featureCard: {
    width: '100%',
    backgroundColor: '#2D3332',
    borderColor: '#4B5B55',
    borderWidth: 1,
    borderRadius: 19,
    padding: 21,
  },
  featureCardWide: {
    flex: 1,
    minHeight: 205,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skyMint,
    marginBottom: 18,
  },
  featureEyebrow: {
    color: colors.skyMint,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.05,
  },
  featureTitle: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.45,
    marginTop: 7,
  },
  featureBody: {
    color: '#C1CCC7',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 9,
  },
  bottomCallout: {
    marginTop: 18,
    backgroundColor: colors.skyMint,
    borderRadius: 20,
    paddingHorizontal: 21,
    paddingVertical: 22,
  },
  bottomCalloutWide: {
    minHeight: 118,
    marginTop: 18,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomCalloutCopy: {
    flexShrink: 1,
  },
  bottomCalloutEyebrow: {
    color: '#16685C',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.05,
  },
  bottomCalloutTitle: {
    color: LIGHT_INK,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.65,
    marginTop: 5,
    maxWidth: 560,
  },
  bottomCalloutButton: {
    minHeight: 45,
    borderRadius: 13,
    paddingHorizontal: 16,
    marginTop: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.graphite,
    gap: 8,
  },
  bottomCalloutButtonWide: {
    marginTop: 0,
    alignSelf: 'center',
    marginLeft: 24,
  },
  bottomCalloutButtonText: {
    color: LIGHT_SURFACE,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
});
