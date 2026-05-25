import React from 'react';
import { Text } from 'react-native';

import { Card } from '../components/Card';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { typography } from '../theme';

export const SettingsScreen: React.FC = () => (
  <ScreenContainer>
    <ScreenHeader label="Club Controls" title="Settings" />

    <Card>
      <SectionLabel>Coming Soon</SectionLabel>
      <Text style={typography.body}>
        Banner customization, club preferences, and account options will live here.
      </Text>
    </Card>
  </ScreenContainer>
);
