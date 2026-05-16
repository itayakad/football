import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { colors, spacing, typography } from '../theme';

export const FriendsScreen: React.FC = () => (
  <ScreenContainer>
    <View>
      <Text style={typography.label}>Social</Text>
      <Text style={[typography.display, styles.title]}>Friends</Text>
    </View>

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
  title: {
    marginTop: spacing.xs,
  },
  note: {
    color:     colors.text.secondary,
    marginTop: spacing.sm,
  },
});
