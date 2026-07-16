import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { colors, radius, spacing, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ScreenHeaderIcon {
  name:  IconName;
  color: string;
}

interface Props {
  label:        string;
  title:        string;
  icons?:       ScreenHeaderIcon[];
  right?:       React.ReactNode;
  onTitlePress?: () => void;
}

export const ScreenHeader: React.FC<Props> = ({ label, title, icons, right, onTitlePress }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const rightNode = right !== undefined ? right : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to home"
      onPress={() => navigation.navigate('Home')}
      style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}
    >
      <Ionicons name="home-outline" size={16} color={colors.text.primary} />
      <Text style={styles.homeButtonText}>Home</Text>
    </Pressable>
  );

  return (
    <View style={styles.block}>
      <View style={styles.topRow}>
        <View style={styles.labelGroup}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {icons && icons.length > 0 && (
            <View style={styles.iconRow}>
              {icons.map((icon, i) => (
                <View key={i} style={styles.iconCircle}>
                  <Ionicons name={icon.name} size={14} color={icon.color} />
                </View>
              ))}
            </View>
          )}
        </View>
        {rightNode}
      </View>
      {onTitlePress ? (
        <Pressable
          onPress={onTitlePress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.titleRow, pressed && styles.titleRowPressed]}
        >
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Ionicons name="chevron-down" size={20} color={colors.text.secondary} />
        </Pressable>
      ) : (
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    gap: spacing.xs,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    flexShrink:    1,
    gap:           spacing.xs,
  },
  label: {
    ...typography.heading,
    color:          colors.text.secondary,
    textTransform:  'uppercase',
    letterSpacing:  0.8,
    flexShrink:     1,
  },
  iconRow: {
    flexDirection: 'row',
    gap:           4,
    flexShrink:    0,
  },
  iconCircle: {
    width:           22,
    height:          22,
    borderRadius:    11,
    flexShrink:      0,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.bg.surface,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  homeButton: {
    minHeight:         34,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: spacing.sm,
    borderRadius:      radius.sm,
    backgroundColor:   colors.bg.surface,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  homeButtonPressed: {
    backgroundColor: colors.bg.elevated,
  },
  homeButtonText: {
    ...typography.label,
    color: colors.text.primary,
  },
  title: {
    ...typography.display,
    color:      colors.text.primary,
    flexShrink: 1,
    minWidth:   0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    alignSelf:     'flex-start',
  },
  titleRowPressed: {
    opacity: 0.6,
  },
});
