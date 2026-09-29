import { Stack } from 'expo-router';

import { useColors } from '@/constants/theme';
import { useAuthSession } from '@/features/auth/auth-context';

export default function OnboardingLayout() {
  const colors = useColors();
  const { isSignedIn } = useAuthSession();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="setup" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
