import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

type Result = 'W' | 'L' | 'T';

interface Props {
  results:   Result[]; // most recent first
  streak?:   { type: 'W' | 'L' | 'T' | 'NONE'; count: number };
  showLabel?: boolean;
}

// Recent-form indicator. Used on Home (your team's form) and Match Preview
// (opponent's form). 5 dots, color-coded, most recent on the right.
// Optional streak label like "W4" or "L2" when ≥ 2 in a row.
export const FormDots: React.FC<Props> = ({ results, streak, showLabel = true }) => {
  // Pad to 5, oldest on the left so the most-recent dot sits closest to the streak label
  const padded: (Result | null)[] = [...Array(5)].map((_, i) =>
    results[results.length - 1 - i] ?? null
  );

  return (
    <View style={styles.row}>
      {padded.map((r, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: dotColor(r) }]}
        />
      ))}
      {showLabel && streak && streak.count >= 2 && streak.type !== 'NONE' && streak.type !== 'T' && (
        <Text style={[styles.label, { color: streak.type === 'W' ? colors.success : colors.danger }]}>
          {streak.type}{streak.count}
        </Text>
      )}
    </View>
  );
};

function dotColor(r: Result | null): string {
  if (r === 'W') return colors.success;
  if (r === 'L') return colors.danger;
  if (r === 'T') return colors.text.muted;
  return colors.bg.surface;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  label: {
    ...typography.label,
    fontSize:     11,
    fontWeight:   '700',
    marginLeft:   spacing.sm,
    letterSpacing: 0.5,
  },
});
