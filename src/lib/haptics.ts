import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are reserved for moments that matter: saving an expense, settling
 * up, and meaningful selections. Never on every tap.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  warning() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
  selection() {
    if (enabled) Haptics.selectionAsync().catch(() => undefined);
  },
  light() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
};
