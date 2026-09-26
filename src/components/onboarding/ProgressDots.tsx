import { View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { colors } from '@/constants/theme';

function Dot({ index, position }: { index: number; position: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(position.get() - index);
    const t = interpolate(distance, [0, 1], [1, 0], 'clamp');
    return { width: 8 + t * 16, opacity: 0.25 + t * 0.75 };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: colors.ink }, style]} />;
}

/** Page indicator that stretches the active dot as you swipe. */
export function ProgressDots({ count, position, current }: { count: number; position: SharedValue<number>; current: number }) {
  return (
    <View className="flex-row items-center gap-1.5" accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${current + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} index={i} position={position} />
      ))}
    </View>
  );
}
