import React from 'react';
import { Users } from 'lucide-react-native';
import PlaceholderScreen from './PlaceholderScreen';

export default function RosterScreen() {
  return (
    <PlaceholderScreen
      icon={Users}
      title="Roster & Teacher Readiness"
      phaseLabel="Coming in Phase 1"
      description="Teacher list, AI-disruption exposure scoring, and curriculum-fit matching land here next."
    />
  );
}
