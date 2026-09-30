import { Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColors } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

import { Text } from './Text';

export type Segment<T extends string> = { value: T; label: string; locked?: boolean };

export type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** Segmented picker with a sliding indicator. */
export function SegmentedControl<T extends string>({ segments, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((s) => s.value === value));
  const segmentWidth = width > 0 ? (width - 8) / segments.length : 0;

  const x = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    // Snap on first layout, glide afterwards.
    const first = w.get() === 0;
    w.set(segmentWidth);
    x.set(first ? index * segmentWidth : withTiming(index * segmentWidth, { duration: 220 }));
  }, [index, segmentWidth, x, w]);

  const indicator = useAnimatedStyle(() => ({ width: w.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      className="h-11 flex-row rounded-[16px] bg-sunken p-1">
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: colors.surface },
            { borderWidth: 1, borderColor: colors.line },
            indicator,
          ]}
        />
      ) : null}
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.locked ? `${segment.label}, locked` : segment.label}
            onPress={() => {
              if (!selected) haptics.selection();
              onChange(segment.value);
            }}
            className="flex-1 flex-row items-center justify-center gap-1">
            <Text variant="label" tone={selected ? 'ink' : 'muted'} numberOfLines={1}>
              {segment.label}
            </Text>
            {segment.locked ? <Lock size={11} color={colors.faint} strokeWidth={2.2} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
