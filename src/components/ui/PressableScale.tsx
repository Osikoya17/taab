import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Don't wrap this in cssInterop: NativeWind already styles it, and an explicit
// interop registration on an animated component drops every non-animated style
// on native (see PressableScale.test.tsx).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  /** Scale when pressed. Cards use 0.98; small controls can go a touch lower. */
  pressedScale?: number;
};

/**
 * Pressable with a quick, subtle scale-down — the base of every tappable surface.
 *
 * Opted out of the React Compiler: NativeWind pushes class styles into the
 * `style` array it receives, so a memoised array would keep stale styles
 * (e.g. a disabled opacity) across renders. A fresh array each render is safe.
 */
export function PressableScale({ children, style, pressedScale = 0.98, onPressIn, onPressOut, disabled, ...props }: PressableScaleProps) {
  'use no memo';
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withTiming(pressedScale, { duration: 120 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: 180 }));
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...props}>
      {children}
    </AnimatedPressable>
  );
}
