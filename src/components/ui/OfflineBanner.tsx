import { onlineManager } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { colors } from '@/constants/theme';

import { Text } from './Text';

export function useIsOnline() {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  );
}

/** A quiet strip, not a blocker: cached data stays usable while offline. */
export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(160)}
      accessibilityRole="alert">
      <View className="mx-5 mb-2 flex-row items-center gap-2 rounded-2xl bg-sunken px-3.5 py-2.5">
        <WifiOff size={15} color={colors.muted} strokeWidth={2} />
        <Text variant="caption" tone="muted" className="flex-1">
          You’re offline. Some changes may sync later.
        </Text>
      </View>
    </Animated.View>
  );
}
