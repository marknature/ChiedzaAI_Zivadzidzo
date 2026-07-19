import './global.css';
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';

import { supabase, isSupabaseConfigured } from './src/lib/supabaseClient';
import { apiFetch } from './src/lib/api';
import { colors } from './src/theme/colors';
import AuthScreen from './src/screens/AuthScreen';
import RootNavigator from './src/navigation/RootNavigator';
import Button from './src/components/common/Button';
import { navigationRef } from './src/navigation/navigationRef';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000';

// Fetches the caller's trusted profile right after sign-in. Membership provisioning is
// deliberately an administrator/invite workflow, so this call can return pending access.
async function syncProfile(accessToken) {
  const response = await fetch(`${API_URL}/auth/session-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({}),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Could not sync session.');
  return result.profile;
}

export default function App() {
  const [fontsLoaded] = useFonts({
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
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const hydrateFromSession = useCallback(async (nextSession) => {
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    try {
      const syncedProfile = await syncProfile(nextSession.access_token);
      setProfile(syncedProfile);
      setProfileError(null);
    } catch (error) {
      console.warn('Profile sync failed:', error.message);
      setProfile(null);
      setProfileError(error.message || 'Your account is awaiting assignment.');
    }
  }, []);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return Notifications.requestPermissionsAsync();
      return null;
    }).catch(() => undefined);
    if (!isSupabaseConfigured) {
      // Every workflow now uses authenticated, server-side decision support. Do not
      // open a partial offline demo when the tenant/auth configuration is missing.
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      hydrateFromSession(data.session).finally(() => setLoading(false));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      hydrateFromSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [hydrateFromSession]);

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
  }, []);

  if (!fontsLoaded || loading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <StatusBar style="light" />
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  // A missing public Supabase configuration is a setup state, not a reason to expose
  // unauthenticated assessment UI. AuthScreen renders the actionable setup guidance.
  if (!isSupabaseConfigured) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen />
      </>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <StatusBar style="light" />
        <View className="w-full max-w-md bg-surface border border-border rounded-3xl p-6">
          <Text className="text-ink font-display text-xl text-center">Institution access pending</Text>
          <Text className="text-ink-muted text-sm leading-relaxed text-center mt-3">
            {profileError || 'Your account is awaiting assignment by an institution administrator.'}
          </Text>
          <Text className="text-ink-faint text-xs leading-relaxed text-center mt-3">A trusted administrator must assign your institution and role before school information can be opened.</Text>
          <Button variant="secondary" className="mt-6" onPress={() => hydrateFromSession(session)}>Check again</Button>
          <Button variant="danger" className="mt-3" onPress={handleSignOut}>Sign out</Button>
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
