import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TeamIdentity } from '../../api/types';
import { teamArchetypeLabel } from '../../utils/teamArchetype';
import { pixelAssets } from './assets';
import { pixelTypography } from '../../theme';

interface Props {
  week: number;
  totalWeeks: number;
  opponentName: string;
  identity: TeamIdentity;
  onPress: () => void;
}

export const OpponentPanel: React.FC<Props> = ({ week, totalWeeks, opponentName, identity, onPress }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={`Next opponent ${opponentName}`} onPress={onPress} style={styles.panel}>
    <Image source={pixelAssets.panel} resizeMode="stretch" style={styles.panelArt} />
    <View style={styles.weekRow}>
      <Text style={styles.week}>{`WEEK ${week} / ${totalWeeks}`}</Text>
    </View>
    <View style={styles.details}>
      <Image source={pixelAssets.helmet} resizeMode="contain" style={styles.helmet} />
      <View style={styles.copy}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.name}>{opponentName}</Text>
        <View style={styles.identityRow}>
          <Text numberOfLines={1} style={styles.nickname}>{teamArchetypeLabel(identity)}</Text>
          <TraitIcon icon={offenseIcon(identity.offense)} color={offenseColor(identity.offense)} />
          <TraitIcon icon={defenseIcon(identity.defense)} color={defenseColor(identity.defense)} />
        </View>
      </View>
    </View>
  </Pressable>
);

function TraitIcon({ icon, color }: { icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return <View style={styles.trait}><Ionicons name={icon} size={12} color={color} /></View>;
}

function offenseIcon(identity: TeamIdentity['offense']): keyof typeof Ionicons.glyphMap {
  if (identity === 'RUN_HEAVY') return 'footsteps';
  if (identity === 'PASS_HEAVY' || identity === 'VERTICAL') return 'paper-plane';
  return 'git-branch';
}

function defenseIcon(identity: TeamIdentity['defense']): keyof typeof Ionicons.glyphMap {
  if (identity === 'PRESSURE') return 'flash';
  if (identity === 'MAN_HEAVY') return 'person';
  if (identity === 'ZONE_HEAVY') return 'grid';
  return 'shield-checkmark';
}

function offenseColor(identity: TeamIdentity['offense']) {
  return identity === 'RUN_HEAVY' ? '#F08A3C' : identity === 'BALANCED' ? '#A8B1C1' : '#5DB4FF';
}

function defenseColor(identity: TeamIdentity['defense']) {
  return identity === 'PRESSURE' ? '#FF5C55' : identity === 'BALANCED' ? '#A8B1C1' : '#55B9FF';
}

const styles = StyleSheet.create({
  panel: { width: '100%', aspectRatio: 1432 / 455, position: 'relative' },
  panelArt: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  weekRow: { position: 'absolute', left: '5.5%', top: '15%', right: '5%' },
  week: { ...pixelTypography.body, fontSize: 9, color: '#48A5F5' },
  details: {
    position: 'absolute', left: '14%', right: '9%', top: '42%', bottom: '12%',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  helmet: { width: '15%', height: '82%' },
  copy: { flex: 1, minWidth: 0, gap: 8 },
  name: { ...pixelTypography.heading, fontSize: 14, color: '#F5F5F5' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nickname: { ...pixelTypography.caption, fontSize: 8, flexShrink: 1, color: '#A6B0C1' },
  trait: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(20, 47, 78, .9)',
    alignItems: 'center', justifyContent: 'center',
  },
});
