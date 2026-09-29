import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColors } from '@/constants/theme';

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const WIDTH = 46;
const HEIGHT = 28;
const KNOB = 22;

/** A calm custom switch that matches the taab palette on both platforms. */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  const colors = useColors();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: 180 }));
  }, [value, progress]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.lineStrong, colors.ink]),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * (WIDTH - KNOB - 6) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={{ opacity: disabled ? 0.4 : 1 }}>
      <Animated.View style={[{ width: WIDTH, height: HEIGHT, borderRadius: HEIGHT / 2, padding: 3 }, track]}>
        <Animated.View
          style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.surface }, knob]}
        />
      </Animated.View>
    </Pressable>
  );
}
