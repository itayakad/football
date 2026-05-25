import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../components/Card';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { colors, spacing, typography } from '../theme';

export const FriendsScreen: React.FC = () => (
  <ScreenContainer>
    <ScreenHeader label="Social" title="Friends" />

    <Card>
      <SectionLabel>Coming Soon</SectionLabel>
      <Text style={typography.body}>
        Friend leagues, challenges, and shared match results will live here.
      </Text>
      <Text style={[typography.caption, styles.note]}>
        This placeholder keeps the home shortcut wired while the social systems are built.
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
