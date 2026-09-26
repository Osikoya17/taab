import { useRouter, type Href } from 'expo-router';

/**
 * Closes the current screen. Screens can be opened directly (deep links, push
 * notifications, web reloads) with nothing behind them, so fall back to a
 * sensible destination instead of doing nothing.
 */
export function useGoBack() {
  const router = useRouter();
  return (fallback: Href = '/') => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
}
