import './global.css';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Linking, Platform, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';

import { supabase, isSupabaseConfigured } from './src/lib/supabaseClient';
import { apiFetch } from './src/lib/api';
import AuthScreen from './src/screens/AuthScreen';
import LandingScreen from './src/screens/LandingScreen';
import RootNavigator from './src/navigation/RootNavigator';
import Button from './src/components/common/Button';
import { navigationRef } from './src/navigation/navigationRef';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000';
const PROFILE_SYNC_TIMEOUT_MS = 8000;

// Fetches the caller's trusted profile right after sign-in. Membership provisioning is
// deliberately an administrator/invite workflow, so this call can return pending access.
async function syncProfile(accessToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROFILE_SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/auth/session-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      throw new Error(result.error || `Could not sync session (${response.status}).`);
    }
    return result.profile;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Profile sync timed out. Check that the ZivaDzidzo backend is running and reachable.');
    }
    if (/network request failed|failed to fetch/i.test(error.message || '')) {
      throw new Error(`Cannot reach the ZivaDzidzo API at ${API_URL}. Start the backend, then try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default function App() {
  useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [publicEntry, setPublicEntry] = useState(null);
  const profileHydrationId = useRef(0);

  const hydrateFromSession = useCallback(async (nextSession) => {
    const hydrationId = ++profileHydrationId.current;
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setProfileError(null);
      setProfileSyncing(false);
      return;
    }
    setProfile(null);
    setProfileError(null);
    setProfileSyncing(true);
    try {
      const syncedProfile = await syncProfile(nextSession.access_token);
      if (hydrationId !== profileHydrationId.current) return;
      setProfile(syncedProfile);
      setProfileError(null);
      setProfileSyncing(false);
    } catch (error) {
      if (hydrationId !== profileHydrationId.current) return;
      console.warn('Profile sync failed:', error.message);
      setProfile(null);
      setProfileError(error.message || 'Your account is awaiting assignment.');
      setProfileSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let isMounted = true;
    let receivedAuthEvent = false;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!isMounted || receivedAuthEvent) return;
        // Do not block the public landing page on local session recovery or the
        // backend profile request. A recovered session transitions into the private
        // workspace as soon as the trusted profile arrives.
        void hydrateFromSession(data.session);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.warn('Session restore failed:', error.message);
        setSession(null);
        setProfile(null);
        setProfileError(null);
        setProfileSyncing(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // getSession above owns the initial boot path; ignoring this duplicate event
      // prevents two profile-sync calls during first paint.
      if (event === 'INITIAL_SESSION') return;
      receivedAuthEvent = true;
      void hydrateFromSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [hydrateFromSession]);

  useEffect(() => {
    if (!isSupabaseConfigured || Platform.OS === 'web') return undefined;

    const completeEmailRedirect = async (url) => {
      const code = url?.match(/[?&]code=([^&#]+)/)?.[1];
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(code));
      if (error) console.warn('Email confirmation could not complete:', error.message);
    };

    void Linking.getInitialURL().then(completeEmailRedirect).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void completeEmailRedirect(url);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const destination = response.notification.request.content.data?.screen;
      if (destination === 'Dashboard' && navigationRef.isReady()) {
        navigationRef.navigate('Dashboard');
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!profile || !isSupabaseConfigured) return;
    Notifications.getPermissionsAsync()
      .then(async ({ status }) => {
        const permission = status === 'granted' ? status : (await Notifications.requestPermissionsAsync()).status;
        if (permission !== 'granted') return null;
        return Notifications.getExpoPushTokenAsync({ projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID });
      })
      .then((tokenResult) => tokenResult && apiFetch('/notifications/token', { method: 'POST', body: JSON.stringify({ expoPushToken: tokenResult.data }) }))
      .catch((error) => console.warn('Push notifications are unavailable:', error.message));
  }, [profile]);

  const handleSignOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setPublicEntry(null);
  }, []);

  const openAuthentication = useCallback((mode) => {
    setPublicEntry(mode === 'sign_up' ? 'sign_up' : 'sign_in');
  }, []);

  const publicScreen = publicEntry ? (
    <AuthScreen initialMode={publicEntry} onBack={() => setPublicEntry(null)} />
  ) : (
    <LandingScreen onOpenAuth={openAuthentication} />
  );

  // A missing public Supabase configuration is a setup state, not a reason to expose
  // unauthenticated assessment UI. AuthScreen renders the actionable setup guidance.
  if (!isSupabaseConfigured) {
    return (
      <>
        <StatusBar style="light" />
        {publicScreen}
      </>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        {publicScreen}
      </>
    );
  }

  if (!profile) {
    const membershipPending = /awaiting assignment by an institution administrator/i.test(profileError || '');
    const title = profileSyncing
      ? 'Opening your dashboard'
      : (membershipPending ? 'Institution access pending' : 'Dashboard unavailable');
    const description = profileSyncing
      ? 'Verifying your institution access securely.'
      : (profileError || 'Your account is awaiting assignment by an institution administrator.');
    return (
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <StatusBar style="light" />
        <View className="w-full max-w-md bg-surface border border-border rounded-3xl p-6">
          {profileSyncing && (
            <View className="items-center mb-4">
              <ActivityIndicator color="#18C3A6" size="small" />
            </View>
          )}
          <Text className="text-ink font-display text-xl text-center">{title}</Text>
          <Text className="text-ink-muted text-sm leading-relaxed text-center mt-3">
            {description}
          </Text>
          {!profileSyncing && (
            <>
              <Text className="text-ink-faint text-xs leading-relaxed text-center mt-3">
                {membershipPending
                  ? 'A trusted administrator must assign your institution and role before school information can be opened.'
                  : 'Check that the ZivaDzidzo backend is running, then try again.'}
              </Text>
              <Button variant="secondary" className="mt-6" onPress={() => hydrateFromSession(session)}>Check again</Button>
              <Button variant="danger" className="mt-3" onPress={handleSignOut}>Sign out</Button>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator profile={profile} userEmail={session.user?.email} onSignOut={handleSignOut} />
    </>
  );
}
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
