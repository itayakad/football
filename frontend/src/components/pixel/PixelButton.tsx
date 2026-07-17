import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import { pixelAssets } from './assets';
import { pixelTypography } from '../../theme';

interface Props {
  label: string;
  tint: string;
  icon: ImageSourcePropType;
  onPress: () => void;
}

export const PixelButton: React.FC<Props> = ({ label, tint, icon, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: tint }, pressed && styles.pressed]}
  >
    <Image source={pixelAssets.button} resizeMode="stretch" style={styles.buttonArt} />
    <View style={styles.content}>
      <Image source={icon} resizeMode="contain" style={styles.icon} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.label}>{label}</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    flex: 1,
    aspectRatio: 1.45,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10130D',
    shadowColor: '#071507',
    shadowOpacity: 0.55,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 5 },
    elevation: 4,
  },
  pressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
  buttonArt: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.56,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  icon: { width: '52%', height: '48%' },
  label: {
    ...pixelTypography.heading,
    fontSize: 9,
    color: '#F7F7F7',
    textAlign: 'center',
    textShadowColor: '#1B1B1B',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
});
