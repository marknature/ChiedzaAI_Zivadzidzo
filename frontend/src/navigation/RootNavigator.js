import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ArrowLeft,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings as SettingsIcon,
  Users,
  ChevronRight,
} from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import CurriculumAuditScreen from '../screens/CurriculumAuditScreen';
import RosterScreen from '../screens/RosterScreen';
import MySchoolScreen from '../screens/MySchoolScreen';
import ChatScreen from '../screens/ChatScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme/colors';
import { navigationRef } from './navigationRef';

const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    border: colors.border,
    primary: colors.teal,
  },
};

const ICONS = {
  Dashboard: LayoutDashboard,
  'My School': Building2,
  Assess: ClipboardCheck,
  Reports: FileText,
  More: Menu,
};

function MoreScreen({ profile, userEmail, onSignOut }) {
  const [activeScreen, setActiveScreen] = useState(null);
  const options = [
    { id: 'roster', label: 'Teacher roster', description: 'Review readiness and run Teacher Roles assessments.', Icon: Users },
    { id: 'assistant', label: 'ZivaDzidzo Assistant', description: 'Ask for evidence-led guidance across your school.', Icon: MessageCircle },
    { id: 'settings', label: 'Settings & limitations', description: 'Review account access and decision-support boundaries.', Icon: SettingsIcon },
  ];

  if (activeScreen === 'roster') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <Pressable className="flex-row items-center px-5 py-4 border-b border-border" onPress={() => setActiveScreen(null)}>
          <ArrowLeft color={colors.inkMuted} size={18} />
          <Text className="text-ink-muted text-sm font-body-semibold ml-2">Back to More</Text>
        </Pressable>
        <RosterScreen />
      </SafeAreaView>
    );
  }

  if (activeScreen === 'assistant') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <Pressable className="flex-row items-center px-5 py-4 border-b border-border" onPress={() => setActiveScreen(null)}>
          <ArrowLeft color={colors.inkMuted} size={18} />
          <Text className="text-ink-muted text-sm font-body-semibold ml-2">Back to More</Text>
        </Pressable>
        <ChatScreen />
      </SafeAreaView>
    );
  }

  if (activeScreen === 'settings') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <Pressable className="flex-row items-center px-5 py-4 border-b border-border" onPress={() => setActiveScreen(null)}>
          <ArrowLeft color={colors.inkMuted} size={18} />
          <Text className="text-ink-muted text-sm font-body-semibold ml-2">Back to More</Text>
        </Pressable>
        <SettingsScreen profile={profile} userEmail={userEmail} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView className="flex-1 bg-bg px-5 pt-8" contentContainerStyle={{ paddingBottom: 36 }}>
        <Text className="text-ink-muted text-xs uppercase tracking-widest">ZivaDzidzo workspace</Text>
        <Text className="text-ink font-display text-2xl mt-1">More tools</Text>
        <Text className="text-ink-muted text-sm leading-relaxed mt-2 mb-6">Supporting workflows stay close at hand without crowding the primary school-leader journey.</Text>
        {options.map(({ id, label, description, Icon }) => (
          <Pressable
            key={id}
            className="flex-row items-center bg-surface border border-border rounded-2xl p-4 mb-3"
            onPress={() => setActiveScreen(id)}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <View className="w-10 h-10 rounded-xl bg-indigo/10 items-center justify-center mr-3">
              <Icon color={colors.indigo} size={19} />
            </View>
            <View className="flex-1 pr-3">
              <Text className="text-ink font-body-semibold">{label}</Text>
              <Text className="text-ink-muted text-xs leading-relaxed mt-1">{description}</Text>
            </View>
            <ChevronRight color={colors.inkFaint} size={18} />
          </Pressable>
        ))}

        <Pressable
          className="flex-row items-center bg-red/10 border border-red/25 rounded-2xl p-4 mt-2"
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <View className="w-10 h-10 rounded-xl bg-red/10 items-center justify-center mr-3">
            <LogOut color={colors.red} size={19} />
          </View>
          <Text className="text-red font-body-semibold flex-1">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function RootNavigator({ profile, userEmail, onSignOut }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 760;

  return (
    <NavigationContainer theme={NavTheme} ref={navigationRef}>
      <Tab.Navigator
        sceneContainerStyle={{ backgroundColor: colors.bg }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelPosition: 'below-icon',
          // bottom-tabs defaults to a translucent/blurred background on iOS (and can
          // leave the surrounding container unstyled on web), which reads as a white
          // nav bar against this app's dark theme. A solid tabBarBackground forces the
          // real theme color everywhere instead of relying on tabBarStyle alone.
          tabBarBackground: () => <View style={{ flex: 1, backgroundColor: colors.bg }} />,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            height: isTablet ? 72 : 66,
            paddingBottom: isTablet ? 6 : 5,
            paddingTop: 4,
            maxWidth: isTablet ? 720 : undefined,
            alignSelf: 'center',
            width: isTablet ? '100%' : undefined,
          },
          tabBarItemStyle: { paddingHorizontal: isTablet ? 8 : 1 },
          tabBarLabelStyle: { fontSize: isTablet ? 11 : 9, fontFamily: 'Inter_600SemiBold' },
          tabBarActiveTintColor: colors.teal,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarIcon: ({ color, size }) => {
            const Icon = ICONS[route.name];
            return Icon ? <Icon color={color} size={size ?? 20} /> : null;
          },
        })}
      >
        <Tab.Screen name="Dashboard">
          {(props) => <DashboardScreen {...props} profile={profile} />}
        </Tab.Screen>
        <Tab.Screen name="My School" options={{ title: 'My School' }}>
          {(props) => <MySchoolScreen {...props} profile={profile} />}
        </Tab.Screen>
        <Tab.Screen name="Assess" component={CurriculumAuditScreen} />
        <Tab.Screen name="Reports" component={ReportsScreen} />
        <Tab.Screen name="More">
          {() => <MoreScreen profile={profile} userEmail={userEmail} onSignOut={onSignOut} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
