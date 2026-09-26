import { View } from 'react-native';

import { TaabLogo } from '@/components/ui/TaabLogo';

/**
 * Landing route for the OAuth browser redirect. Clerk completes the session
 * and the route guards then move the user on; this just avoids a blank flash.
 */
export default function SsoCallback() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <TaabLogo size="medium" />
    </View>
  );
}
