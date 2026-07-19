import React from 'react';
import { View, Text } from 'react-native';

// Visual technique borrowed from ZivaBasa's ShapLedger (diverging bar chart centered on a
// midline), adapted to our schema and deliberately renamed: ZivaDzidzo's
// contributing_factors are self-reported by the LLM, not a mechanistic SHAP decomposition
// (see prompt.md Section 6.3 / KNOWN_LIMITATIONS.md) - calling this "ShapLedger" would
// misrepresent what it is. `relative_weight` here is already 0-1 (schema-enforced), so no
// max-normalization step is needed the way ZivaBasa normalizes raw shap_value magnitudes.
//
// `caveats` is a required prop, not optional - it must always render, never be hidden
// behind a modal/tooltip (product requirement, see prompt.md Phase 1 step 6).
export default function ContributingFactorsLedger({ contributingFactors, caveats }) {
  const factors = Array.isArray(contributingFactors) ? contributingFactors : [];

  return (
    <View className="gap-4">
      {!!factors.length && (
        <View className="gap-3">
          {factors.map((factor, index) => {
          const isIncreasesRisk = factor.direction === 'increases_risk';
          const pct = Math.max(0, Math.min(1, factor.relative_weight)) * 50;
          return (
            <View key={`${factor.factor}-${index}`} className="gap-1">
              <View className="flex-row items-center gap-3">
                <Text className="text-ink-muted text-xs flex-1" numberOfLines={2}>{factor.factor}</Text>
                <Text className={`text-xs w-24 text-right ${isIncreasesRisk ? 'text-red' : 'text-teal'}`}>
                  {isIncreasesRisk ? 'Increases risk' : 'Decreases risk'}
                </Text>
              </View>
              <View className="h-2 rounded-full bg-surface2 overflow-hidden relative">
                <View className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                <View
                  className={`absolute top-0 bottom-0 rounded-full ${isIncreasesRisk ? 'bg-red right-1/2' : 'bg-teal left-1/2'}`}
                  style={{ width: `${pct}%` }}
                />
              </View>
              {!!factor.evidence && (
                <Text className="text-[11px] text-ink-faint leading-relaxed">{factor.evidence}</Text>
              )}
            </View>
          );
          })}
        </View>
      )}

      {!factors.length && <Text className="text-ink-faint text-xs">No ranked contributing factors were returned for this assessment.</Text>}

      <View className="border-t border-border pt-3 bg-indigo/5 -mx-1 px-1 rounded-lg">
        <Text className="text-[11px] text-indigo font-body-semibold uppercase tracking-wide mb-1">
          How to read this
        </Text>
        <Text className="text-[11px] text-ink-faint leading-relaxed">{caveats || 'This is LLM-reasoned decision support. Scores and contributing factors are associational, not causal proof.'}</Text>
      </View>
    </View>
  );
}
