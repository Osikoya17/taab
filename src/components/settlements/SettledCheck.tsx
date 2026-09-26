import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CHECK_LENGTH = 40;
const RING_LENGTH = 2 * Math.PI * 34;

/** A check that draws itself in — the one celebratory moment in settling up. */
export function SettledCheck({ size = 96, play = true }: { size?: number; play?: boolean }) {
  const ring = useSharedValue(0);
  const check = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (!play) return;
    ring.set(withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    check.set(withDelay(220, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })));
    scale.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.4)) }));
  }, [play, ring, check, scale]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * (1 - ring.get()) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - check.get()) }));
  const containerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, containerStyle]} accessibilityLabel="Settled" accessible>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Circle cx={40} cy={40} r={30} fill={colors.positiveSoft} />
        <AnimatedCircle
          cx={40}
          cy={40}
          r={34}
          stroke={colors.positive}
          strokeWidth={2.5}
          fill="none"
          strokeDasharray={RING_LENGTH}
          animatedProps={ringProps}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <AnimatedPath
          d="M27 41 L36 50 L54 31"
          stroke={colors.positive}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
          animatedProps={checkProps}
        />
      </Svg>
    </Animated.View>
  );
}
