import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface ContractValueProps {
  amount: number;
  years?: number;
  compact?: boolean;
}

export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1_000)}K`;
}

export const ContractValue: React.FC<ContractValueProps> = ({ amount, years, compact }) => (
  <View style={[styles.container, compact && styles.compact]}>
    <Text style={compact ? styles.compactText : styles.text} numberOfLines={1}>
      {formatMoney(amount)}
      {years !== undefined ? ` / ${years}y` : ''}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  compact: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  text: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '800',
  },
  compactText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '800',
  },
});
