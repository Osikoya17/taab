import '@/global.css';
import '@/services/mock/device-storage';

import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { useFonts } from 'expo-font';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogProvider, usePostHog } from 'posthog-react-native';

import { EXTRAS_ENABLED } from '@/features/billing/products';
import { SplashOverlay } from '@/components/brand/SplashOverlay';
import { NotificationPrompt } from '@/components/notifications/NotificationPrompt';
import { AppLock } from '@/components/security/AppLock';
import { ToastHost } from '@/components/ui/Toast';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { useColors } from '@/constants/theme';
import { useAuthSession } from '@/features/auth/auth-context';
import { AuthProvider } from '@/features/auth/auth-provider';
import { useNotificationRouting } from '@/features/notifications/routing';
import { useApplyAppearance } from '@/hooks/use-appearance';
import { useProfile } from '@/features/profile/queries';
import { queryClient, queryPersister, wireQueryEnvironment } from '@/lib/query-client';
import { usePreferences } from '@/store/preferences.store';
import { env, isDemoAuth } from '@/lib/env';
import { posthog } from '@/lib/posthog';
import { posthogLog } from '@/lib/posthog-logs';

SplashScreen.preventAutoHideAsync();
wireQueryEnvironment();

/**
 * Establishes a persistent PostHog identity (the account id, no personal
 * details) exactly when the authenticated session becomes known. The SDK applies this identity to subsequent events
 * and captured exceptions until logout resets it.
 */
function PostHogIdentitySync() {
  const posthogClient = usePostHog();
  const { isLoaded, user } = useAuthSession();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      if (identifiedUserId.current) {
        posthogLog.info('Authenticated session ended');
        posthogClient.reset();
        identifiedUserId.current = null;
      }
      return;
    }

    if (identifiedUserId.current === user.id) return;

    if (identifiedUserId.current) posthogClient.reset();

    // Identify by the opaque account id only: names and emails stay out of analytics.
    posthogClient.identify(user.id, {
      $set_once: {
        created_at: user.createdAt,
      },
    });
    identifiedUserId.current = user.id;
    posthogLog.info('Authenticated session is ready');
  }, [isLoaded, posthogClient, user]);

  return null;
}

function RootNavigator({ onReady }: { onReady: (ready: boolean) => void }) {
  const colors = useColors();
  const router = useRouter();
  const pendingInvite = usePreferences((s) => s.pendingInvite);
  const { isSignedIn } = useAuthSession();
  const hydrated = usePreferences((s) => s.hydrated);
  const hasSeenOnboarding = usePreferences((s) => s.hasSeenOnboarding);
  const profile = useProfile();

  const setupComplete = profile.data?.setupComplete ?? false;
  const ready = hydrated && (!isSignedIn || profile.isFetched || !!profile.data);
  const inApp = isSignedIn && setupComplete;

  useNotificationRouting(ready && inApp);

  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);
  useEffect(() => {
    if (ready && inApp) posthogLog.info('Authenticated application navigation is ready');
  }, [ready, inApp]);
  useEffect(() => {
    if (ready && inApp && pendingInvite) router.replace({ pathname: '/join/[token]', params: { token: pendingInvite } });
  }, [ready, inApp, pendingInvite, router]);

  if (!ready) return null;
  if (isSignedIn && profile.isError && !profile.data) {
    return <Screen><ErrorState title="Couldn’t load your account." onRetry={() => profile.refetch()} retrying={profile.isRefetching} /></Screen>;
  }

  return (
    <>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
          <Stack.Protected guard={(!isSignedIn && !hasSeenOnboarding) || (isSignedIn && !setupComplete)}>
            <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
          </Stack.Protected>

          <Stack.Protected guard={!isSignedIn}>
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          </Stack.Protected>

          <Stack.Protected guard={inApp}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="group/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="group/[id]/index" />
            <Stack.Screen name="group/[id]/invite" options={{ presentation: 'modal' }} />
            <Stack.Screen name="group/[id]/recurring" />
            <Stack.Screen name="expense/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="expense/[id]/index" />
            <Stack.Screen name="expense/[id]/edit" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settle/index" />
            <Stack.Screen name="settle/record" options={{ presentation: 'modal' }} />
            <Stack.Screen name="reminder/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="notifications/index" />
            {/* Receipt scanning and packs are switched off (EXTRAS_ENABLED); links to them land on Home. */}
            <Stack.Protected guard={EXTRAS_ENABLED}>
              <Stack.Screen name="subscription/index" />
              <Stack.Screen name="extras/index" />
              <Stack.Screen name="scan/index" options={{ presentation: 'modal' }} />
              <Stack.Screen name="scan/[id]" />
              <Stack.Screen name="scan/bulk" />
            </Stack.Protected>
            <Stack.Screen name="settings" />
          </Stack.Protected>

          <Stack.Screen name="sso-callback" />
          <Stack.Screen name="join/[token]" />
        </Stack>
        {inApp ? <NotificationPrompt /> : null}
    </>
  );
}

/**
 * Waits for auth, then mounts the data layer keyed by user. The persisted
 * cache is "busted" per user, and in-memory data is cleared the moment the
 * account changes, so one person never sees another's cached taabs.
 */
function AppShell({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colorScheme } = useColorScheme();
  const { isLoaded, user } = useAuthSession();
  const [navReady, setNavReady] = useState(false);
  const userId = user?.id ?? 'signed-out';
  const previousUser = useRef(userId);

  if (previousUser.current !== userId) {
    previousUser.current = userId;
    queryClient.clear();
  }

  useEffect(() => {
    // Hand over from the native splash to the in-app one as soon as fonts render.
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (isDemoAuth !== !env.apiUrl) {
    return <Screen><ErrorState title="Account setup is incomplete." description="Configure both the sign-in service and API address, or leave both empty to explore the demo." /></Screen>;
  }

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {isLoaded && fontsLoaded ? (
        <PersistQueryClientProvider
          key={userId}
          client={queryClient}
          persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000, buster: userId }}>
          <RootNavigator onReady={setNavReady} />
        </PersistQueryClientProvider>
      ) : null}
      <ToastHost />
      <SplashOverlay ready={navReady} />
      {isLoaded ? <AppLock /> : null}
    </>
  );
}

export default function RootLayout() {
  const colors = useColors();
  useApplyAppearance();
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      {posthog ? (
        <PostHogProvider client={posthog}>
          <AuthProvider>
            <PostHogIdentitySync />
            <AppShell fontsLoaded={fontsLoaded || !!fontError} />
          </AuthProvider>
        </PostHogProvider>
      ) : (
        <AuthProvider>
          <AppShell fontsLoaded={fontsLoaded || !!fontError} />
        </AuthProvider>
      )}
    </GestureHandlerRootView>
  );
}
