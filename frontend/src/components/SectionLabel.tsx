import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { typography, spacing } from '../theme';

// Tiny uppercase label that sits above content sections.
// Used liberally — gives the dashboard its newspaper-y feel.
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.wrap}>
    <Text style={typography.label}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
});
