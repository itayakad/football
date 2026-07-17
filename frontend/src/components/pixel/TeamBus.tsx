import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { pixelAssets } from './assets';
import { PlayerHead } from './PlayerHead';

interface Props {
  occupants: number;
}

const WINDOW_POSITIONS = [
  { left: '8%', top: '15%', width: '10.5%', height: '38%' },
  { left: '20.5%', top: '15%', width: '10.5%', height: '38%' },
  { left: '33%', top: '15%', width: '10.5%', height: '38%' },
  { left: '45.5%', top: '15%', width: '10.5%', height: '38%' },
  { left: '58%', top: '15%', width: '10.5%', height: '38%' },
  { left: '70.5%', top: '15%', width: '8%', height: '38%' },
] as const;

export const TeamBus: React.FC<Props> = ({ occupants }) => (
  <View style={styles.frame}>
    <Image source={pixelAssets.bus} resizeMode="stretch" style={styles.bus} />
    {/* TODO: replace these generic heads with the team's top-player portraits once
        the home-game presentation is established and portrait art is available. */}
    {WINDOW_POSITIONS.slice(0, Math.max(0, Math.min(occupants, WINDOW_POSITIONS.length))).map((position, index) => (
      <PlayerHead
        key={index}
        source={pixelAssets.playerHeads[index % pixelAssets.playerHeads.length]}
        style={position}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1247 / 442,
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bus: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
