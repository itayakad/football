import React from 'react';
import { StyleSheet, View, ViewStyle, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface Props {
  children:    React.ReactNode;
  scroll?:     boolean;
  style?:      ViewStyle;
  contentStyle?: ViewStyle;
}

// Standard screen wrapper. Handles safe-area + dark background + horizontal padding.
// Pass scroll={false} for screens that need fixed layout (e.g. live feed).
export const ScreenContainer: React.FC<Props> = ({ children, scroll = true, style, contentStyle }) => {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fixed, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xxl,
    gap:               spacing.lg,
  },
  fixed: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
});
