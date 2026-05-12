import React from 'react';
import { View, ViewStyle, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?:   ViewStyle;
  onPress?: () => void;
  padded?:  boolean;
  raised?:  boolean;
}

// Standard surface for content blocks. Tap-able when onPress provided.
// raised = slightly higher elevation (used for primary "next match" card on Home).
export const Card: React.FC<CardProps> = ({ children, style, onPress, padded = true, raised }) => {
  const content = (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        raised && styles.raised,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.elevated,
    borderRadius:    radius.lg,
  },
  padded: {
    padding: spacing.lg,
  },
  raised: {
    backgroundColor: colors.bg.elevated,
    // subtle "lift" via inner contrast — no shadows, keeps the matte feel
  },
});
