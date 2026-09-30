import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { authenticate, getBiometricSupport, type BiometricSupport } from '@/features/security/biometrics';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/store/preferences.store';
import { toast } from '@/store/toast.store';

export default function SecurityScreen() {
  const biometricLock = usePreferences((s) => s.biometricLock);
  const setBiometricLock = usePreferences((s) => s.setBiometricLock);
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBiometricSupport().then(setSupport).catch(() => setSupport({ hardware: false, enrolled: false, label: 'biometrics' }));
  }, []);

  const label = support?.label ?? 'fingerprint';
  const title = `Unlock with ${label === 'Face ID' ? 'Face ID' : label}`;
  const usable = !!support?.hardware && !!support.enrolled;

  // Checking the owner both ways means someone holding an unlocked phone can't switch it off.
  async function change(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await authenticate(next ? `Use your ${label} to lock taab` : 'Confirm it’s you'))) return;
      setBiometricLock(next);
      haptics.success();
      toast.show(next ? `taab will ask for your ${label}` : 'App lock is off');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<AppHeader back title="Security" />}>
      <Text variant="body" tone="muted" className="pt-2">
        Keep your taabs private if someone else picks up your phone.
      </Text>

      {Platform.OS === 'web' ? (
        <Surface className="mt-5">
          <Text variant="body" tone="muted">
            App lock works in the taab app on your phone. On the web, sign out when you’re on a shared computer.
          </Text>
        </Surface>
      ) : support && !usable ? (
        <Surface className="mt-5 gap-3">
          <View>
            <Text variant="bodyStrong">{support.hardware ? `Set up ${label} first` : 'No fingerprint reader found'}</Text>
            <Text variant="caption" tone="muted" className="mt-0.5">
              {support.hardware
                ? `Add a ${label === 'Face ID' ? 'face' : 'fingerprint'} in your phone’s settings, then come back to turn on app lock.`
                : 'This phone doesn’t have a fingerprint reader or face unlock that taab can use.'}
            </Text>
          </View>
          {support.hardware ? <Button label="Open phone settings" size="md" variant="secondary" onPress={() => Linking.openSettings()} /> : null}
        </Surface>
      ) : (
        <>
          <Surface padded={false} className="mt-5">
            <ListRow
              title={title}
              detail="Asks when you open taab, and when you come back after 30 seconds away"
              trailing={<Toggle value={biometricLock} onValueChange={change} accessibilityLabel={title} disabled={busy || !support} />}
            />
          </Surface>
          <Text variant="caption" tone="faint" className="mt-3 px-1">
            If your {label} doesn’t work, your phone offers its passcode instead. The lock only applies to this phone.
          </Text>
        </>
      )}
    </Screen>
  );
}
