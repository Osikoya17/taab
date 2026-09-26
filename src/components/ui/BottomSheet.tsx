import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from '@/constants/theme';

import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
};

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };
const OFFSCREEN = 800;

/**
 * Lightweight sheet for menus, confirmations and short forms. Springs in,
 * dims the background, and can be dragged down to dismiss.
 */
export function BottomSheet({ visible, onClose, title, description, children }: BottomSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(OFFSCREEN);
  const backdrop = useSharedValue(0);

  // Mount as soon as we become visible; unmount after the close animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      translateY.set(withSpring(0, SPRING));
      backdrop.set(withTiming(1, { duration: 220 }));
    } else if (mounted) {
      backdrop.set(withTiming(0, { duration: 180 }));
      translateY.set(
        withTiming(OFFSCREEN, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, mounted, translateY, backdrop]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(onClose);
      else translateY.set(withSpring(0, SPRING));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            style={[
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingBottom: Math.max(bottom, 16) + 8,
              },
              sheetStyle,
            ]}>
            <GestureDetector gesture={pan}>
              <View className="items-center pb-2 pt-3">
                <View className="h-1 w-10 rounded-full bg-line-strong" />
              </View>
            </GestureDetector>
            {title ? (
              <View className="px-6 pb-2 pt-2">
                <Text variant="heading" accessibilityRole="header">
                  {title}
                </Text>
                {description ? (
                  <Text variant="body" tone="muted" className="mt-1">
                    {description}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View className="px-6 pt-3">{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
