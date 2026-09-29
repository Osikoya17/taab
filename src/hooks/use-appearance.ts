import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { usePreferences } from '@/store/preferences.store';

/**
 * Applies the saved appearance and keeps it applied. On iOS and Android
 * "system" hands control back to the device. On web, class-based dark mode
 * never follows the system by itself, so we watch the media query and set
 * light or dark explicitly — otherwise classes and code-set colours disagree.
 */
export function useApplyAppearance() {
  const appearance = usePreferences((s) => s.appearance);
  const hydrated = usePreferences((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (Platform.OS !== 'web' || appearance !== 'system') {
      colorScheme.set(appearance);
      return;
    }
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) {
      colorScheme.set('light');
      return;
    }
    const apply = () => colorScheme.set(media.matches ? 'dark' : 'light');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance, hydrated]);
}
