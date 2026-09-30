import { Fingerprint } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { TaabLogo } from '@/components/ui/TaabLogo';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useAuthActions, useAuthSession } from '@/features/auth/auth-context';
import { authenticate, getBiometricSupport } from '@/features/security/biometrics';
import { shouldLockOnReturn } from '@/features/security/lock';
import { usePreferences } from '@/store/preferences.store';

/**
 * Covers the app until the owner unlocks it with their fingerprint (or face,
 * or the phone's passcode). Locks on launch and after 30 seconds away.
 * Only mounts on phones, and only when the owner switched it on.
 */
export function AppLock() {
  const { isSignedIn } = useAuthSession();
  const hydrated = usePreferences((s) => s.hydrated);
  const biometricLock = usePreferences((s) => s.biometricLock);
  if (Platform.OS === 'web' || !hydrated || !biometricLock || !isSignedIn) return null;
  return <LockGate />;
}

function LockGate() {
  const colors = useColors();
  const { signOut } = useAuthActions();
  const [locked, setLocked] = useState(true);
  const [label, setLabel] = useState('fingerprint');
  const [busy, setBusy] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setBusy(true);
    try {
      if (await authenticate('Unlock taab')) setLocked(false);
    } finally {
      prompting.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    getBiometricSupport().then((s) => setLabel(s.label)).catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      // The fingerprint prompt itself makes the app briefly inactive; only real trips away count.
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active') {
        if (shouldLockOnReturn(backgroundedAt.current, Date.now())) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  // Ask straight away whenever the lock appears.
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  if (!locked) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, zIndex: 1000 }]} accessibilityViewIsModal>
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <TaabLogo size="medium" />
        <View className="items-center gap-2">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-sunken">
            <Fingerprint size={30} color={colors.ink} strokeWidth={1.6} />
          </View>
          <Text variant="heading" className="mt-2 text-center">
            taab is locked
          </Text>
          <Text variant="body" tone="muted" className="text-center">
            Use your {label} to open your taabs.
          </Text>
        </View>
      </View>
      <View className="gap-2 px-6 pb-12">
        <Button label="Unlock" icon={Fingerprint} onPress={unlock} loading={busy} />
        <Button label="Sign out instead" variant="ghost" onPress={() => signOut().catch(() => undefined)} />
      </View>
    </View>
  );
}
