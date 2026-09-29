import { useColorScheme } from 'nativewind';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import palettes, { type Palette } from './palette';

export type { Palette };

/** The light palette. In components, use `useColors()` so dark mode applies. */
export const colors: Palette = palettes.light;

/**
 * Colours for the active theme, for anything set in code (icons, inline
 * styles). Classes like `bg-canvas` switch on their own.
 */
export function useColors(): Palette {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? palettes.dark : palettes.light;
}

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export const radii = {
  input: 18,
  button: 20,
  card: 22,
  nav: 30,
  pill: 999,
} as const;

/** Space above the floating tab bar so content never hides behind it. */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_GAP = 12;

/** Soft ambient shadow, reserved for floating elements. */
export const floatingShadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#111111', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 10, shadowColor: 'rgba(17,17,17,0.35)' },
  default: { boxShadow: '0 10px 30px rgba(17,17,17,0.10)' },
}) as ViewStyle;

export const durations = {
  fast: 160,
  base: 240,
  slow: 340,
} as const;

/** Removes the browser's default focus ring on web; our inputs draw their own focus state. */
export const noFocusRing = (Platform.OS === 'web' ? { outlineWidth: 0, outlineStyle: 'none' } : {}) as TextStyle;
