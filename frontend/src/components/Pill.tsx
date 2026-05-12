import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface PillProps {
  label: string;
  color?: string; // background tint (semi-transparent applied)
}

// Compact tag for style identity (PASS_HEAVY, AGGRESSIVE, FAST, etc.)
// Color encodes meaning — see colors.identity.
export const Pill: React.FC<PillProps> = ({ label, color = colors.identity.bal }) => (
  <View style={[styles.pill, { backgroundColor: hexWithAlpha(color, 0.18) }]}>
    <Text style={[styles.text, { color }]}>{label}</Text>
  </View>
);

function hexWithAlpha(hex: string, alpha: number): string {
  // Quick converter: '#RRGGBB' + alpha → 'rgba(r,g,b,a)'
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Map style strings to identity colors
export function pillColor(style: string): string {
  switch (style) {
    case 'PASS_HEAVY':  return colors.identity.pass;
    case 'RUN_HEAVY':   return colors.identity.run;
    case 'AGGRESSIVE':  return colors.identity.agg;
    case 'PREVENT':     return colors.identity.prv;
    case 'FAST':        return colors.identity.fast;
    case 'SLOW':        return colors.identity.slow;
    case 'FOUR_VERTICALS':
    case 'VERTICAL_SPREAD':
    case 'PA_CROSSERS':
    case 'PLAY_ACTION_HEAVY':
      return colors.identity.pass;
    case 'POWER_RUN':
    case 'HB_STRETCH':
    case 'COUNTER':
    case 'SMASHMOUTH':
    case 'STACKED_FRONT':
    case 'RUN_BLITZ':
      return colors.identity.run;
    case 'MAN_BLITZ':
    case 'ROBBER_COVERAGE':
      return colors.identity.agg;
    case 'DEEP_QUARTERS':
    case 'FORCE_UNDERNEATH':
    case 'COVER_2_SHELL':
      return colors.identity.prv;
    case 'MESH':
    case 'LEVELS':
    case 'SLANTS_FLATS':
    case 'WEST_COAST':
    case 'QUICK_GAME':
    case 'RPO_HEAVY':
    case 'ZONE_MATCH':
    case 'CONTAIN_EDGES':
      return colors.identity.bal;
    case 'BALANCED':
    case 'NORMAL':
    default:            return colors.identity.bal;
  }
}

// Friendly label for the various enum values
export function pillLabel(value: string): string {
  const special: Record<string, string> = {
    RPO_HEAVY: 'RPO Heavy',
    PA_CROSSERS: 'PA Crossers',
    HB_STRETCH: 'HB Stretch',
    COVER_2_SHELL: 'Cover 2 Shell',
  };
  if (special[value]) return special[value];
  return value.replace(/_/g, ' ');
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.pill,
    alignSelf:         'flex-start',
  },
  text: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.6,
  },
});
