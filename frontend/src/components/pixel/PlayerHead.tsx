import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

interface Props {
  source: ImageSourcePropType;
  style?: object;
}

export const PlayerHead: React.FC<Props> = ({ source, style }) => (
  <View pointerEvents="none" style={[styles.head, style]}>
    <Image
      source={source}
      resizeMode="contain"
      style={[StyleSheet.absoluteFillObject, styles.image]}
    />
  </View>
);

const styles = StyleSheet.create({
  head: { position: 'absolute', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
