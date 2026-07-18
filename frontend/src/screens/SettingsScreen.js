import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Settings as SettingsIcon, LogOut, ShieldAlert } from 'lucide-react-native';

export default function SettingsScreen({ profile, userEmail, onSignOut }) {
  return (
    <View className="flex-1 bg-[#0A0F1D] px-6 pt-8">
      <View className="items-center mb-8">
        <SettingsIcon color="#3B82F6" size={32} />
        <Text className="text-white text-xl font-bold mt-3">Settings</Text>
      </View>

      <View className="bg-[#141B2D] border border-gray-800 rounded-2xl p-5 mb-4">
        <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">Signed in as</Text>
        <Text className="text-white font-medium">{userEmail || 'Unknown user'}</Text>
        {!!profile?.full_name && <Text className="text-gray-400 text-sm mt-2">{profile.full_name}</Text>}
        {!!profile?.role && <Text className="text-gray-500 text-xs mt-1">Role: {profile.role}</Text>}
      </View>

      <View className="bg-[#141B2D] border border-gray-800 rounded-2xl p-5 mb-6 flex-row items-start">
        <ShieldAlert color="#F59E0B" size={18} />
        <Text className="text-gray-300 text-xs leading-relaxed ml-3 flex-1">
          Every ZivaDzidzo prediction is a GPT-4o structured-output completion, not a trained model, and its
          explanation is self-reported, not a mechanistic decomposition. See KNOWN_LIMITATIONS.md.
        </Text>
      </View>

      <TouchableOpacity
        className="bg-red-500/10 border border-red-500/40 rounded-xl py-4 flex-row items-center justify-center"
        onPress={onSignOut}
      >
        <LogOut color="#F87171" size={16} />
        <Text className="text-red-400 font-semibold ml-2">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
