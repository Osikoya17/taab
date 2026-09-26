import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts } from '@/constants/theme';

const SIZES = {
  small: { fontSize: 22, letterSpacing: -0.9 },
  medium: { fontSize: 34, letterSpacing: -1.4 },
  large: { fontSize: 64, letterSpacing: -2.8 },
} as const;

export type TaabLogoProps = {
  size?: keyof typeof SIZES;
  color?: string;
  /**
   * Plays the "split the tab" motion once: the letters part by a few pixels
   * around the double-a and come back together (under a second).
   */
  animateSplit?: boolean;
  onSplitComplete?: () => void;
};

/**
 * The taab wordmark. Rendered as text for now and isolated here so the final
 * custom SVG (with the fractured "a") can replace it without touching screens.
 */
export function TaabLogo({ size = 'medium', color = colors.ink, animateSplit = false, onSplitComplete }: TaabLogoProps) {
  const { fontSize, letterSpacing } = SIZES[size];
  const gap = useSharedValue(0);

  useEffect(() => {
    if (!animateSplit) return;
    const offset = Math.max(2, fontSize * 0.06);
    gap.set(
      withDelay(
        120,
        withSequence(
          withTiming(offset, { duration: 280, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 320, easing: Easing.inOut(Easing.cubic) }),
        ),
      ),
    );
    // Matches the animation length (120 + 280 + 320ms) plus a short hold.
    const timer = setTimeout(() => onSplitComplete?.(), 820);
    return () => clearTimeout(timer);
  }, [animateSplit, fontSize, gap, onSplitComplete]);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -gap.get() }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: gap.get() }] }));

  const textStyle = {
    fontFamily: fonts.bold,
    fontSize,
    lineHeight: fontSize * 1.1,
    letterSpacing,
    color,
    includeFontPadding: false,
  } as const;

  return (
    <View accessible accessibilityRole="header" accessibilityLabel="taab" className="flex-row">
      <Animated.Text style={[textStyle, leftStyle]} allowFontScaling={false}>
        ta
      </Animated.Text>
      <Animated.Text style={[textStyle, rightStyle]} allowFontScaling={false}>
        ab
      </Animated.Text>
    </View>
  );
}
