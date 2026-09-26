import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/constants/theme';

/**
 * Bottom padding that keeps content clear of the floating tab bar (or just
 * the home indicator on screens without it).
 */
export function useBottomInset(withTabBar: boolean) {
  const { bottom } = useSafeAreaInsets();
  const safe = Math.max(bottom, 12);
  return withTabBar ? safe + TAB_BAR_HEIGHT + TAB_BAR_GAP + 16 : safe + 16;
}
