import { Redirect } from 'expo-router';
import { Platform, View } from 'react-native';

import { TaabLogo } from '@/components/ui/TaabLogo';
import { useAuthSession } from '@/features/auth/auth-context';

/**
 * Landing route for the OAuth browser redirect. This screen sits outside the
 * route guards, and guards only redirect when the current screen becomes
 * protected — so once auth has settled, hand off to "/" and let the guards
 * pick onboarding, setup, sign-in or the app.
 *
 * On web the redirect opens in the auth popup, where expo-web-browser passes
 * the result back to the opener and closes the window; don't navigate there.
 */
export default function SsoCallback() {
  const { isLoaded } = useAuthSession();
  const inAuthPopup = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.opener;

  if (isLoaded && !inAuthPopup) return <Redirect href="/" />;

  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <TaabLogo size="medium" />
    </View>
  );
}
