import React from 'react';
import { FileText } from 'lucide-react-native';
import PlaceholderScreen from './PlaceholderScreen';

export default function ReportsScreen() {
  return (
    <PlaceholderScreen
      icon={FileText}
      title="Executive Reports"
      phaseLabel="Coming in Phase 3"
      description="Generate Word/PDF reports from a prediction or a chat conversation, with embedded charts."
    />
  );
}
