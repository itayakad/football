import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface ButtonProps {
  label:    string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?:   ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  label, onPress, variant = 'primary', loading, disabled, style,
}) => {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={!!(disabled || loading)}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        pressed ? (isPrimary ? styles.primaryPressed : styles.ghostPressed) : null,
        (disabled || loading) ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.text.inverse : colors.text.primary} />
      ) : (
        <Text style={[styles.label, !isPrimary && { color: colors.text.primary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical:   spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius:      radius.md,
    alignItems:        'center',
    justifyContent:    'center',
  },
  primary:        { backgroundColor: colors.accent.primary },
  primaryPressed: { backgroundColor: colors.accent.pressed },
  ghost:          { backgroundColor: colors.bg.surface },
  ghostPressed:   { backgroundColor: colors.bg.elevated },
  label: {
    ...typography.heading,
    color: colors.text.inverse,
    fontWeight: '700',
  },
});
