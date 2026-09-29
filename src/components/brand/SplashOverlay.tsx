import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { TaabLogo } from '@/components/ui/TaabLogo';
import { useColors } from '@/constants/theme';

/**
 * Picks up exactly where the native splash leaves off (same warm white, same
 * wordmark), plays the brief "split" motion, then fades away once the app is
 * ready. Total time stays under a second on a warm start.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const colors = useColors();
  const [animationDone, setAnimationDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Latch: once dismissed, stay dismissed even if `ready` flips later (e.g. on sign-in).
  if (ready && animationDone && !dismissed) setDismissed(true);
  if (dismissed) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(220)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', zIndex: 50 }]}>
      <TaabLogo size="large" animateSplit onSplitComplete={() => setAnimationDone(true)} />
    </Animated.View>
  );
}
