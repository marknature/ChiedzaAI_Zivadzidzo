import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, GraduationCap, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { colors } from '../theme/colors';

const LIGHT_SURFACE = '#F7FAF9';
const INPUT_SURFACE = '#FFFFFF';
const INPUT_BORDER = '#D5E0DC';
const LIGHT_INK = '#25272C';
const LIGHT_MUTED = '#5A6964';

function emailRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return 'zivadzidzo://auth/callback';
}

const MODE_COPY = {
  sign_in: {
    eyebrow: 'Welcome back',
    title: 'Continue the conversation.',
    description: "Sign in to see your school's next best steps.",
    action: 'Sign in securely',
  },
  sign_up: {
    eyebrow: 'Create an account',
    title: 'Start with a clearer view.',
    description: 'Your institution administrator will assign your access after verification.',
    action: 'Create account',
  },
  magic_link: {
    eyebrow: 'Passwordless sign-in',
    title: 'A secure link, sent to you.',
    description: 'We will email a one-time sign-in link to your work address.',
    action: 'Send secure link',
  },
  setup: {
    eyebrow: 'Secure school access',
    title: 'Built for informed school decisions.',
    description: 'Connect the institution configuration to begin.',
    action: '',
  },
};

function AuthTextField({ icon: Icon, label, ...inputProps }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Icon color={focused ? colors.deepTeal : '#71807B'} size={18} strokeWidth={2.1} />
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor="#83918C"
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
        />
      </View>
    </View>
  );
}

function ModeLink({ children, onPress, disabled, variant = 'default' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.modeLink, (pressed || disabled) && styles.modeLinkPressed]}
    >
      <Text style={[styles.modeLinkText, variant === 'brand' && styles.brandLinkText]}>{children}</Text>
    </Pressable>
  );
}

function BrandPanel({ isWide, isTablet, isCompact, mode, onModeChange, disabled, canChangeMode }) {
  const activeCopy = MODE_COPY[mode] || MODE_COPY.sign_in;
  const nextMode = mode === 'sign_in' ? 'sign_up' : 'sign_in';

  return (
    <View style={[styles.brandPanel, isWide ? styles.brandPanelWide : styles.brandPanelNarrow, isTablet && styles.brandPanelTablet, isCompact && styles.brandPanelCompact]}>
      <View pointerEvents="none" style={styles.brandGlowLarge} />
      <View pointerEvents="none" style={styles.brandGlowSmall} />

      <View>
        <View style={styles.brandMarkRow}>
          <View style={styles.brandMark}>
            <GraduationCap color={colors.graphite} size={isWide ? 27 : 23} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.brandName}>ZivaDzidzo</Text>
            <Text style={styles.brandPlatform}>CHIEDZAAI · EDUCATION INTELLIGENCE</Text>
          </View>
        </View>

        <View style={[styles.brandMessage, !isWide && styles.brandMessageNarrow, isTablet && styles.brandMessageTablet]}>
          <Text style={styles.brandEyebrow}>{activeCopy.eyebrow}</Text>
          <Text style={[styles.brandHeading, !isWide && styles.brandHeadingNarrow, isTablet && styles.brandHeadingTablet]}>{activeCopy.title}</Text>
          <Text style={[styles.brandDescription, !isWide && styles.brandDescriptionNarrow]}>
            {isWide
              ? 'Turn school data and curriculum evidence into trusted, practical decisions for every learner.'
              : 'Trusted school intelligence for practical decisions.'}
          </Text>
        </View>
      </View>

      {isWide && (
        <View>
          <View style={styles.trustRow}>
            <ShieldCheck color={colors.skyMint} size={18} strokeWidth={2.2} />
            <Text style={styles.trustText}>Institutional access is verified before school data is opened.</Text>
          </View>
          {canChangeMode && (
            <ModeLink variant="brand" disabled={disabled} onPress={() => onModeChange(nextMode)}>
              {mode === 'sign_in' ? 'New to ZivaDzidzo? Create an account' : 'Already have an account? Sign in'}
            </ModeLink>
          )}
        </View>
      )}
    </View>
  );
}

function AuthForm({ mode, email, password, feedback, loading, onEmailChange, onPasswordChange, onSubmit, onModeChange, disabled }) {
  const copy = MODE_COPY[mode];
  const isMagicLink = mode === 'magic_link';

  return (
    <View style={styles.formContent}>
      <View style={styles.formHeading}>
        <View style={styles.formEyebrowRow}>
          <Sparkles color={colors.deepTeal} size={15} strokeWidth={2.25} />
          <Text style={styles.formEyebrow}>{copy.eyebrow}</Text>
        </View>
        <Text style={styles.formTitle}>{copy.title}</Text>
        <Text style={styles.formDescription}>{copy.description}</Text>
      </View>

      <View style={styles.fields}>
        <AuthTextField
          icon={Mail}
          label="Work email"
          placeholder="name@school.edu"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType={isMagicLink ? 'send' : 'next'}
          value={email}
          onChangeText={onEmailChange}
          onSubmitEditing={isMagicLink ? onSubmit : undefined}
          editable={!loading && !disabled}
        />

        {!isMagicLink && (
          <AuthTextField
            icon={Lock}
            label="Password"
            placeholder={mode === 'sign_up' ? 'Choose a secure password' : 'Enter your password'}
            autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
            textContentType={mode === 'sign_up' ? 'newPassword' : 'password'}
            secureTextEntry
            returnKeyType="go"
            value={password}
            onChangeText={onPasswordChange}
            onSubmitEditing={onSubmit}
            editable={!loading && !disabled}
          />
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.action}
        accessibilityState={{ disabled: loading || disabled, busy: loading }}
        disabled={loading || disabled}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.primaryButton,
          (pressed || loading || disabled) && styles.primaryButtonPressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>{loading ? 'Please wait…' : copy.action}</Text>
      </Pressable>

      {!!feedback && (
        <View
          accessibilityRole="alert"
          style={[styles.feedback, feedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError]}
        >
          <Text style={[styles.feedbackText, feedback.tone === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText]}>
            {feedback.message}
          </Text>
        </View>
      )}

      {mode === 'sign_up' && (
        <Text style={styles.termsText}>
          Creating an account does not grant access to an institution. A trusted administrator must assign your role.
        </Text>
      )}

      <View style={styles.formLinks}>
        {!isMagicLink && (
          <ModeLink disabled={loading || disabled} onPress={() => onModeChange('magic_link')}>
            Use a magic link instead
          </ModeLink>
        )}
        {isMagicLink && (
          <ModeLink disabled={loading || disabled} onPress={() => onModeChange('sign_in')}>
            Use a password instead
          </ModeLink>
        )}
        <View style={styles.linkDivider} />
        <ModeLink
          disabled={loading || disabled}
          onPress={() => onModeChange(mode === 'sign_up' ? 'sign_in' : 'sign_up')}
        >
          {mode === 'sign_in' || isMagicLink ? 'Create an account' : 'Sign in'}
        </ModeLink>
      </View>
    </View>
  );
}

function ConfigurationNotice() {
  return (
    <View style={styles.formContent}>
      <View style={styles.formHeading}>
        <View style={styles.formEyebrowRow}>
          <ShieldCheck color={colors.deepTeal} size={16} strokeWidth={2.25} />
          <Text style={styles.formEyebrow}>Secure setup required</Text>
        </View>
        <Text style={styles.formTitle}>Connect this app to its institution.</Text>
        <Text style={styles.formDescription}>
          Add the public Supabase URL and publishable key to the frontend environment, then reload to enable secure sign-in.
        </Text>
      </View>

      <View style={styles.setupCallout}>
        <Text style={styles.setupCode}>EXPO_PUBLIC_SUPABASE_URL</Text>
        <Text style={styles.setupCode}>EXPO_PUBLIC_SUPABASE_KEY</Text>
      </View>
      <Text style={styles.setupHint}>
        These are public client settings. Keep service-role and AI provider keys on the backend only.
      </Text>
    </View>
  );
}

function AuthShell({ children, intro, formTransition, isWide, isTablet, isCompact, mode, onModeChange, changingMode, canChangeMode = true, onBack }) {
  const insets = useSafeAreaInsets();
  const entranceTranslateY = intro.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const entranceScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] });
  const formTranslateX = formTransition.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.background}>
        <View pointerEvents="none" style={styles.backgroundMintTop} />
        <View pointerEvents="none" style={styles.backgroundMintBottom} />
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to ZivaDzidzo overview"
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [
              styles.backButton,
              { top: styles.backButton.top + insets.top },
              isWide && [styles.backButtonWide, { top: styles.backButtonWide.top + insets.top }],
              pressed && styles.backButtonPressed,
            ]}
          >
            <ArrowLeft color={LIGHT_SURFACE} size={17} strokeWidth={2.3} />
            <Text style={styles.backButtonText}>Overview</Text>
          </Pressable>
        )}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWide ? styles.scrollContentWide : styles.scrollContentNarrow,
            onBack && !isWide && [styles.scrollContentNarrowWithBack, { paddingTop: styles.scrollContentNarrowWithBack.paddingTop + insets.top }],
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.authSurface,
              isWide ? styles.authSurfaceWide : styles.authSurfaceNarrow,
              { opacity: intro, transform: [{ translateY: entranceTranslateY }, { scale: entranceScale }] },
            ]}
          >
            <BrandPanel
              isWide={isWide}
              isTablet={isTablet}
              isCompact={isCompact}
              mode={mode}
              disabled={changingMode}
              onModeChange={onModeChange}
              canChangeMode={canChangeMode}
            />
            <View style={[styles.formPanel, isWide ? styles.formPanelWide : styles.formPanelNarrow, isTablet && styles.formPanelTablet, isCompact && styles.formPanelCompact]}>
              <Animated.View style={{ opacity: formTransition, transform: [{ translateX: formTranslateX }] }}>
                {children}
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// Membership is assigned by a trusted institution administrator or invite workflow.
// Sign-up creates an auth account only; it never selects a school or role client-side.
export default function AuthScreen({ initialMode = 'sign_in', onBack }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const isTablet = isWide && width < 960;
  const isCompact = width < 390;
  const [mode, setMode] = useState(initialMode); // 'sign_in' | 'sign_up' | 'magic_link'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [changingMode, setChangingMode] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const intro = useRef(new Animated.Value(0)).current;
  const formTransition = useRef(new Animated.Value(1)).current;
  const previousMode = useRef(mode);

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
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    if (reduceMotion) {
      formTransition.setValue(1);
      setChangingMode(false);
      return;
    }
    formTransition.setValue(0);
    Animated.timing(formTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setChangingMode(false));
  }, [formTransition, mode, reduceMotion]);

  const changeMode = useCallback((nextMode) => {
    if (nextMode === mode || changingMode || loading) return;
    setFeedback(null);
    if (reduceMotion) {
      setMode(nextMode);
      return;
    }
    setChangingMode(true);
    Animated.timing(formTransition, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMode(nextMode);
      } else {
        formTransition.setValue(1);
        setChangingMode(false);
      }
    });
  }, [changingMode, formTransition, loading, mode, reduceMotion]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setFeedback({ tone: 'error', message: 'Enter your work email address.' });
      return;
    }
    setFeedback(null);
    setLoading(true);
    try {
      if (mode === 'magic_link') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: emailRedirectUrl() },
        });
        if (error) throw error;
        setFeedback({ tone: 'success', message: 'Check your work email for the secure sign-in link.' });
        return;
      }

      if (!password) {
        setFeedback({ tone: 'error', message: 'Enter your password.' });
        return;
      }

      const { error } =
        mode === 'sign_up'
          ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: emailRedirectUrl() },
          })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) throw error;

      if (mode === 'sign_up') {
        setFeedback({ tone: 'success', message: 'Account created. Confirm your email, then sign in.' });
        setPassword('');
        setMode('sign_in');
      }
      // On successful sign-in, App.js's onAuthStateChange listener takes over
      // (session-sync + navigating into RootNavigator).
    } catch (error) {
      setFeedback({ tone: 'error', message: error.message || 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const shellProps = {
    intro,
    formTransition,
    isWide,
    isTablet,
    isCompact,
    mode,
    onModeChange: changeMode,
    changingMode,
    onBack,
  };

  if (!isSupabaseConfigured) {
    return (
      <AuthShell {...shellProps} mode="setup" canChangeMode={false}>
        <ConfigurationNotice />
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      <AuthForm
        mode={mode}
        email={email}
        password={password}
        feedback={feedback}
        loading={loading}
        disabled={changingMode}
        onEmailChange={(value) => {
          setEmail(value);
          if (feedback) setFeedback(null);
        }}
        onPasswordChange={(value) => {
          setPassword(value);
          if (feedback) setFeedback(null);
        }}
        onSubmit={handleSubmit}
        onModeChange={changeMode}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.graphite,
  },
  background: {
    flex: 1,
    backgroundColor: colors.graphite,
    overflow: 'hidden',
  },
  backgroundMintTop: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: colors.skyMint,
    opacity: 0.1,
    top: -205,
    right: -110,
  },
  backgroundMintBottom: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.skyMint,
    opacity: 0.08,
    bottom: -170,
    left: -100,
  },
  backButton: {
    position: 'absolute',
    zIndex: 3,
    top: 14,
    left: 15,
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#303A37',
    borderColor: '#52615C',
    borderWidth: 1,
  },
  backButtonWide: {
    top: 24,
    left: 30,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    color: LIGHT_SURFACE,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginLeft: 7,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentWide: {
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  scrollContentNarrow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  scrollContentNarrowWithBack: {
    paddingTop: 66,
  },
  authSurface: {
    width: '100%',
    maxWidth: 1040,
    backgroundColor: LIGHT_SURFACE,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.28,
    shadowRadius: 38,
    elevation: 12,
  },
  authSurfaceWide: {
    minHeight: 620,
    flexDirection: 'row',
  },
  authSurfaceNarrow: {
    minHeight: 0,
  },
  brandPanel: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.graphite,
  },
  brandPanelWide: {
    width: '45%',
    minHeight: 620,
    justifyContent: 'space-between',
    paddingHorizontal: 44,
    paddingVertical: 46,
  },
  brandPanelTablet: {
    paddingHorizontal: 32,
    paddingVertical: 36,
  },
  brandPanelNarrow: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 26,
  },
  brandPanelCompact: {
    paddingHorizontal: 22,
    paddingTop: 23,
    paddingBottom: 22,
  },
  brandGlowLarge: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: colors.skyMint,
    opacity: 0.11,
    top: -135,
    right: -96,
  },
  brandGlowSmall: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: colors.skyMint,
    opacity: 0.22,
    bottom: -75,
    right: 32,
  },
  brandMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skyMint,
    marginRight: 12,
  },
  brandName: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 21,
    letterSpacing: -0.5,
  },
  brandPlatform: {
    color: '#BFCBC6',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    letterSpacing: 1.05,
    marginTop: 3,
  },
  brandMessage: {
    marginTop: 78,
  },
  brandMessageNarrow: {
    marginTop: 30,
  },
  brandMessageTablet: {
    marginTop: 52,
  },
  brandEyebrow: {
    color: colors.skyMint,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  brandHeading: {
    color: LIGHT_SURFACE,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 39,
    lineHeight: 45,
    letterSpacing: -1.3,
    marginTop: 14,
  },
  brandHeadingNarrow: {
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.8,
    marginTop: 9,
  },
  brandHeadingTablet: {
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.95,
  },
  brandDescription: {
    color: '#CDD8D3',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 17,
    maxWidth: 320,
  },
  brandDescriptionNarrow: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 9,
    maxWidth: 420,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#52615C',
  },
  trustText: {
    flex: 1,
    color: '#CDD8D3',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },
  formPanel: {
    backgroundColor: LIGHT_SURFACE,
  },
  formPanelWide: {
    width: '55%',
    justifyContent: 'center',
    paddingHorizontal: 54,
    paddingVertical: 48,
  },
  formPanelTablet: {
    paddingHorizontal: 36,
  },
  formPanelNarrow: {
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 30,
  },
  formPanelCompact: {
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 26,
  },
  formContent: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  formHeading: {
    marginBottom: 28,
  },
  formEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formEyebrow: {
    color: colors.deepTeal,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.05,
    marginLeft: 7,
    textTransform: 'uppercase',
  },
  formTitle: {
    color: LIGHT_INK,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.9,
    marginTop: 12,
  },
  formDescription: {
    color: LIGHT_MUTED,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },
  fields: {
    marginBottom: 22,
  },
  fieldGroup: {
    marginBottom: 15,
  },
  fieldLabel: {
    color: '#3E4C47',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginBottom: 7,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 15,
    backgroundColor: INPUT_SURFACE,
    borderColor: INPUT_BORDER,
    borderWidth: 1,
    borderRadius: 13,
  },
  fieldFocused: {
    borderColor: colors.deepTeal,
    borderWidth: 1.5,
    shadowColor: colors.deepTeal,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: LIGHT_INK,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    paddingVertical: 13,
    paddingHorizontal: 11,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skyMint,
    shadowColor: '#5CD2B1',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  primaryButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: colors.graphite,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  feedback: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  feedbackError: {
    backgroundColor: '#FFF0F0',
    borderColor: '#F3B9BD',
  },
  feedbackSuccess: {
    backgroundColor: '#EAF9F3',
    borderColor: '#A9DFC9',
  },
  feedbackText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  feedbackErrorText: {
    color: '#A5202A',
  },
  feedbackSuccessText: {
    color: '#146144',
  },
  termsText: {
    color: LIGHT_MUTED,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 15,
  },
  formLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modeLink: {
    paddingVertical: 5,
  },
  modeLinkPressed: {
    opacity: 0.58,
  },
  modeLinkText: {
    color: colors.blue,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  brandLinkText: {
    color: colors.skyMint,
  },
  linkDivider: {
    width: 1,
    height: 15,
    backgroundColor: '#C8D4CF',
    marginHorizontal: 12,
  },
  setupCallout: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BDE7D8',
    backgroundColor: '#E6FBF3',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  setupCode: {
    color: '#145C53',
    fontFamily: 'IBMPlexMono_500Medium',
    fontSize: 11,
    lineHeight: 19,
  },
  setupHint: {
    color: LIGHT_MUTED,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 13,
  },
});
