import type { TextStyle } from 'react-native';

/** Midnight Editorial typographic scale — Inter only */
export const typography = {
  /** Hero / splash statements */
  displayLg: {
    fontFamily: 'Inter_900Black',
    fontSize: 56,
    letterSpacing: -1.12,
    lineHeight: 56,
  } satisfies TextStyle,

  displayMd: {
    fontFamily: 'Inter_900Black',
    fontSize: 40,
    letterSpacing: -0.8,
    lineHeight: 40,
  } satisfies TextStyle,

  /** Section headings */
  headlineLg: {
    fontFamily: 'Inter_900Black',
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 34,
  } satisfies TextStyle,

  headlineMd: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    letterSpacing: -0.48,
    lineHeight: 28,
  } satisfies TextStyle,

  /** Reading text */
  bodyLg: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 26,
  } satisfies TextStyle,

  bodyMd: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  } satisfies TextStyle,

  bodySm: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  } satisfies TextStyle,

  /** Metadata / captions */
  labelMd: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  } satisfies TextStyle,

  labelSm: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  } satisfies TextStyle,
} as const;
