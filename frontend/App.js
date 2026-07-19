import './global.css';
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';

import { supabase, isSupabaseConfigured } from './src/lib/supabaseClient';
import { colors } from './src/theme/colors';
import AuthScreen from './src/screens/AuthScreen';
import RootNavigator from './src/navigation/RootNavigator';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000';

// Provisions (or fetches) the caller's profiles row right after sign-in/sign-up.
// See backend/routes/auth.js - this is the one call that must succeed before any
// other authenticated route will accept the session.
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

  const hydrateFromSession = useCallback(async (nextSession) => {
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      return;
    }
    try {
      const syncedProfile = await syncProfile(nextSession.access_token);
      setProfile(syncedProfile);
    } catch (error) {
      console.warn('Profile sync failed:', error.message);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return Notifications.requestPermissionsAsync();
      return null;
    }).catch(() => undefined);
    if (!isSupabaseConfigured) {
      // Mirrors the backend's own demo-mode fallback: the curriculum-audit flow keeps
      // working without any Supabase project configured, matching the pre-auth demo.
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

  // No Supabase project configured: skip the auth gate entirely so the curriculum
  // auditor (the working demo path) stays usable, same as the backend's own fallback.
  if (!isSupabaseConfigured) {
    return (
      <>
        <StatusBar style="light" />
        <RootNavigator profile={null} userEmail={null} onSignOut={handleSignOut} />
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

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator profile={profile} userEmail={session.user?.email} onSignOut={handleSignOut} />
    </>
  );
}
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
