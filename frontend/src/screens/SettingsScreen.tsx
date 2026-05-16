import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../components/Card';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { colors, spacing, typography } from '../theme';

export const SettingsScreen: React.FC = () => (
  <ScreenContainer>
    <View style={styles.header}>
      <View style={styles.iconCircle}>
        <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
      </View>
      <View style={styles.headerText}>
        <Text style={typography.label}>Club Controls</Text>
        <Text style={[typography.display, styles.title]}>Settings</Text>
      </View>
    </View>

    <Card>
      <SectionLabel>Coming Soon</SectionLabel>
      <Text style={typography.body}>
        Banner customization, club preferences, and account options will live here.
      </Text>
    </Card>
  </ScreenContainer>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  iconCircle: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colors.bg.elevated,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    marginTop: spacing.xs,
  },
});
