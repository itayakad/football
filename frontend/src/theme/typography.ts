import { TextStyle } from 'react-native';
import { colors } from './colors';

// Type scale — large, confident headings. Body is 15 for mobile readability.
// Labels are uppercase tracking — used sparingly for category tags.
export const typography = {
  display: {
    fontSize:    36,
    fontWeight:  '800',
    color:       colors.text.primary,
    letterSpacing: -0.5,
  } as TextStyle,

  title: {
    fontSize:    24,
    fontWeight:  '700',
    color:       colors.text.primary,
    letterSpacing: -0.3,
  } as TextStyle,

  heading: {
    fontSize:    18,
    fontWeight:  '600',
    color:       colors.text.primary,
  } as TextStyle,

  body: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.primary,
    lineHeight: 22,
  } as TextStyle,

  caption: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
    lineHeight: 18,
  } as TextStyle,

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } as TextStyle,

  // Score display — chunky, dominant numbers
  score: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -2,
  } as TextStyle,
};
