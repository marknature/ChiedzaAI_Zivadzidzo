import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Shield, Cpu, RefreshCw, GraduationCap, ChevronRight } from 'lucide-react-native';

export default function App() {
  const [curriculumTitle, setCurriculumTitle] = useState('Computer Science Fundamentals');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Weights and vulnerabilities representing analyzed subjects
  const [subjects, setSubjects] = useState([
    { name: 'Core Syntax & Basics', weight: 0.35, vulnerability: 0.85 }, // High risk of LLM generation
    { name: 'Database Design', weight: 0.25, vulnerability: 0.40 },
    { name: 'Systems Architecture', weight: 0.40, vulnerability: 0.20 } // Highly strategic
  ]);
  const [futureSkillsScore, setFutureSkillsScore] = useState(65); // Out of 100
  const [sriScore, setSriScore] = useState(68.5); 

  // Function to calculate SRI based on parameters: (Weighted Non-Vulnerability + Future Score Offset)
  const calculateLocalSRI = () => {
    let weightedNonVulnerability = 0;
    subjects.forEach(sub => {
      weightedNonVulnerability += sub.weight * (1 - sub.vulnerability);
    });
    
    const alpha = 0.8;
    const computed = (weightedNonVulnerability + alpha * (futureSkillsScore / 100)) * 100;
    setSriScore(parseFloat(computed.toFixed(1)));
  };

  const handleAuditSubmission = async () => {
    if (!rawText.trim()) {
      Alert.alert("Missing Syllabus Data", "Please paste or type syllabus content to evaluate.");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5000/api/audit/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: curriculumTitle,
          gradeLevel: "Tertiary Education",
          syllabusText: rawText,
          alpha: 0.8
        })
      });

      const result = await response.json();
      if (result.success) {
        setSriScore(result.audit.readiness_index);
        Alert.alert("Audit Complete", `ZivaDzidzo analyzed this syllabus. Final SRI score: ${result.audit.readiness_index}%`);
      } else {
        throw new Error(result.error || "Failed payload processing.");
      }
    } catch (err) {
      // Fallback local simulation in case backend is offline
      calculateLocalSRI();
      Alert.alert("Offline Simulator", "Used local calculation model engine.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#0A0F1D] pt-12 px-4">
      <StatusBar style="light" />
      
      {/* Header Profile Title */}
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-gray-400 text-xs tracking-widest uppercase">ChiedzaAI Platform</Text>
          <Text className="text-white text-2xl font-bold tracking-tight">ZivaDzidzo</Text>
        </View>
        <GraduationCap color="#3B82F6" size={28} />
      </View>

      {/* Main SRI Display Card */}
      <View className="bg-[#141B2D] border border-gray-800 rounded-3xl p-6 mb-6">
        <Text className="text-gray-400 text-sm mb-1">Skills Obsolescence & Readiness Index (SRI)</Text>
        <View className="flex-row items-baseline mb-3">
          <Text className="text-white text-5xl font-black">{sriScore}%</Text>
          <Text className="text-emerald-400 text-xs font-bold ml-2">
            {sriScore >= 70 ? '▲ AI READY' : sriScore >= 50 ? '● MODERATE RISK' : '▼ HIGH OBSOLESCENCE'}
          </Text>
        </View>
        
        <Text className="text-gray-400 text-xs leading-relaxed">
          The SRI tracks the resilience of this curriculum against generative AI automation. Lower indices suggest subjects need immediate adaptive updates.
        </Text>
      </View>

      {/* Input Form for Audit */}
      <View className="bg-[#141B2D] border border-gray-800 rounded-3xl p-5 mb-6">
        <Text className="text-white font-semibold text-base mb-3">Auditor Pipeline Input</Text>
        
        <TextInput 
          className="bg-[#0A0F1D] text-white border border-gray-800 rounded-xl px-4 py-3 mb-3"
          placeholder="Curriculum Title"
          placeholderTextColor="#6B7280"
          value={curriculumTitle}
          onChangeText={setCurriculumTitle}
        />

        <TextInput 
          className="bg-[#0A0F1D] text-white border border-gray-800 rounded-xl px-4 py-3 mb-4 h-28"
          placeholder="Paste Syllabus or Course Topics here..."
          placeholderTextColor="#6B7280"
          multiline
          textAlignVertical="top"
          value={rawText}
          onChangeText={setRawText}
        />

        <TouchableOpacity 
          className="bg-accent rounded-xl py-4 flex-row items-center justify-center"
          onPress={handleAuditSubmission}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Shield color="#fff" size={18} className="mr-2" />
              <Text className="text-white font-bold text-center">Execute Chiedza AI Audit</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Curriculum Subject Breakdown */}
      <View className="mb-8">
        <Text className="text-white font-semibold text-lg mb-4">Core Track Weightings</Text>
        {subjects.map((sub, idx) => (
          <View key={idx} className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-white font-medium">{sub.name}</Text>
              <Text className="text-gray-400 text-xs mt-1">Weight: {(sub.weight * 100)}% • Automation Vulnerability: {(sub.vulnerability * 100)}%</Text>
            </View>
            <View className={`w-3 h-3 rounded-full ${sub.vulnerability > 0.6 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}