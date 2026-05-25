import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { Card } from '../components/Card';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { colors, spacing, typography } from '../theme';

export const StadiumScreen: React.FC = () => (
  <ScreenContainer>
    <ScreenHeader label="Club Infrastructure" title="Stadium" />

    <Card>
      <SectionLabel>Coming Soon</SectionLabel>
      <Text style={typography.body}>
        Stadium upgrades, matchday revenue, and facilities will live here.
      </Text>
      <Text style={[typography.caption, styles.note]}>
        This placeholder keeps the route ready while the stadium systems are built.
      </Text>
    </Card>
  </ScreenContainer>
);

const styles = StyleSheet.create({
  note: {
    color:     colors.text.secondary,
    marginTop: spacing.sm,
  },
});
