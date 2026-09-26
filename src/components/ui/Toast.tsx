import { Check, CircleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, floatingShadow } from '@/constants/theme';
import { useToastStore } from '@/store/toast.store';

import { Text } from './Text';

/** Renders the current toast near the top. Mounted once at the root. */
export function ToastHost() {
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => dismiss(current.id), current.description ? 3600 : 2600);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  if (!current) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: top + 8, left: 16, right: 16, zIndex: 100 }}>
      <Animated.View key={current.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
        <Pressable
          onPress={() => dismiss(current.id)}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="flex-row items-center gap-3 rounded-[20px] bg-ink px-4 py-3.5"
          style={floatingShadow}>
          {current.tone === 'success' ? (
            <View className="h-6 w-6 items-center justify-center rounded-full bg-positive">
              <Check size={14} color={colors.surface} strokeWidth={2.6} />
            </View>
          ) : current.tone === 'error' ? (
            <CircleAlert size={20} color="#F2B8AA" strokeWidth={2} />
          ) : null}
          <View className="flex-1">
            <Text variant="bodyStrong" tone="inverse">
              {current.title}
            </Text>
            {current.description ? (
              <Text variant="caption" className="mt-0.5" style={{ color: '#BDBDB8' }}>
                {current.description}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
