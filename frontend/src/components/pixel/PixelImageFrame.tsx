import React from 'react';
import {
  Image,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface Props {
  source: ImageSourcePropType;
  aspectRatio: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

/** A bounded art window for pixel assets; the source cannot expand past the mockup frame. */
export const PixelImageFrame: React.FC<Props> = ({ source, aspectRatio, style, imageStyle }) => (
  <View style={[styles.frame, { aspectRatio }, style]}>
    <Image source={source} resizeMode="stretch" style={[styles.image, imageStyle]} />
  </View>
);

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
