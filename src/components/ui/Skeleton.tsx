import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors } from '@/constants/theme';

type SkeletonProps = { width?: DimensionValue; height?: number; radius?: number };

/** A softly pulsing placeholder block. */
export function Skeleton({ width = '100%', height = 14, radius = 8 }: SkeletonProps) {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.sunken }, style]} />;
}

/** Placeholder shaped like a list row with avatar, two lines and an amount. */
export function RowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 py-3" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width={40} height={40} radius={20} />
      <View className="flex-1 gap-2">
        <Skeleton width="55%" height={13} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={64} height={14} />
    </View>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessible>
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </View>
  );
}

export function BalanceSkeleton() {
  return (
    <View className="gap-3" accessibilityLabel="Loading your balance" accessible>
      <Skeleton width={96} height={13} />
      <Skeleton width={220} height={46} radius={12} />
      <Skeleton width={140} height={13} />
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4" accessibilityElementsHidden>
      <View className="flex-row items-center justify-between">
        <Skeleton width="45%" height={16} />
        <Skeleton width={64} height={24} radius={12} />
      </View>
      <Skeleton width="30%" height={12} />
      <Skeleton width="60%" height={12} />
    </View>
  );
}
