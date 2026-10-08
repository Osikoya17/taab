import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { LOGO_FULL, LOGO_SPLIT } from '@/components/brand/logo-paths';
import { useColors } from '@/constants/theme';

/** Height of the wordmark in points; the width follows the logo's proportions. */
const SIZES = { small: 22, medium: 32, large: 65 } as const;

/*
 * Lining the two drawings up, in the full logo's units: "ab" slides left by
 * SLIDE to make the split state, and the pair is shifted right by CENTRE so
 * "tab" sits in the middle. The split drawing is scaled by SPLIT_SCALE (to
 * match the height of the "t") and moved by SPLIT_DX/SPLIT_DY to land on it.
 * Fitted by comparing renders: the two overlap by about 91%, the rest being
 * the designer's fractured "a", which the short cross-fade covers.
 */
const SLIDE = 170.94;
const CENTRE = 85.5;
const SPLIT_SCALE = 0.9689;
const SPLIT_DX = CENTRE;
const SPLIT_DY = -0.359;

export type TaabLogoProps = {
  size?: keyof typeof SIZES;
  color?: string;
  /**
   * Plays the opening motion once: the logo starts as "tab", the way it looks
   * on the app icon, and "ab" slides out to reveal "taab" (under a second).
   */
  animateSplit?: boolean;
  onSplitComplete?: () => void;
};

/** The taab wordmark, drawn from the designer's logo. */
export function TaabLogo({ size = 'medium', color: colorProp, animateSplit = false, onSplitComplete }: TaabLogoProps) {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  const height = SIZES[size];
  const unit = height / LOGO_FULL.height;
  const width = LOGO_FULL.width * unit;

  // 0 = split ("tab"), 1 = full ("taab").
  const progress = useSharedValue(animateSplit ? 0 : 1);
  // 1 while the split drawing is showing, before the letters start to move.
  const splitVisible = useSharedValue(animateSplit ? 1 : 0);

  useEffect(() => {
    if (!animateSplit) return;
    splitVisible.set(withDelay(120, withTiming(0, { duration: 120 })));
    progress.set(withDelay(200, withTiming(1, { duration: 440, easing: Easing.out(Easing.cubic) })));
    // Matches the motion (200 + 440ms) plus a short hold on "taab".
    const timer = setTimeout(() => onSplitComplete?.(), 820);
    return () => clearTimeout(timer);
  }, [animateSplit, onSplitComplete, progress, splitVisible]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: 1 - splitVisible.get(),
    transform: [{ translateX: (1 - progress.get()) * CENTRE * unit }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: 1 - splitVisible.get(),
    transform: [{ translateX: (1 - progress.get()) * (CENTRE - SLIDE) * unit }],
  }));
  const splitStyle = useAnimatedStyle(() => ({ opacity: splitVisible.get() }));

  const viewBox = `0 0 ${LOGO_FULL.width} ${LOGO_FULL.height}`;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="taab" style={{ width, height }}>
      <Animated.View style={[StyleSheet.absoluteFill, leftStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Path d={LOGO_FULL.t} fill={color} fillRule="evenodd" />
          <Path d={LOGO_FULL.firstA} fill={color} fillRule="evenodd" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, rightStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Path d={LOGO_FULL.secondA} fill={color} fillRule="evenodd" />
          <Path d={LOGO_FULL.b} fill={color} fillRule="evenodd" />
        </Svg>
      </Animated.View>
      {animateSplit ? (
        <Animated.View style={[StyleSheet.absoluteFill, splitStyle]}>
          <Svg width={width} height={height} viewBox={viewBox}>
            <G transform={`translate(${SPLIT_DX} ${SPLIT_DY}) scale(${SPLIT_SCALE})`}>
              <Path d={LOGO_SPLIT.t} fill={color} fillRule="evenodd" />
              <Path d={LOGO_SPLIT.a} fill={color} fillRule="evenodd" />
              <Path d={LOGO_SPLIT.b} fill={color} fillRule="evenodd" />
            </G>
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
