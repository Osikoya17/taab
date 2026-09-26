import { useState } from 'react';
import { View } from 'react-native';

import { PasswordInput } from '@/components/auth/PasswordInput';
import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useAuthActions, useAuthSession } from '@/features/auth/auth-context';
import { toast } from '@/store/toast.store';

export default function ManageAccountScreen() {
  const { user, mode } = useAuthSession();
  const actions = useAuthActions();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    setSaving(true);
    setError(undefined);
    const result = await actions.changePassword(current, next);
    setSaving(false);
    if (result.status === 'error') setError(result.message);
    else {
      setCurrent('');
      setNext('');
      toast.success('Password changed');
    }
  }

  return (
    <Screen keyboard header={<AppHeader back title="Manage account" />}>
      <Text variant="label" tone="muted" className="mb-2 mt-2 px-1">
        Sign-in
      </Text>
      <Surface padded={false}>
        <ListRow title="Email" detail={user?.email} />
        <Divider inset={16} />
        <ListRow title="Account provider" detail={mode === 'clerk' ? 'Secured by Clerk' : 'Demo account on this device'} />
      </Surface>

      <Text variant="label" tone="muted" className="mb-2 mt-7 px-1">
        Change password
      </Text>
      <View className="gap-4">
        <PasswordInput label="Current password" value={current} onChangeText={setCurrent} autoComplete="current-password" textContentType="password" />
        <PasswordInput
          label="New password"
          value={next}
          onChangeText={setNext}
          hint="At least 8 characters."
          error={error}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Button label="Update password" onPress={changePassword} loading={saving} disabled={current.length === 0 || next.length < 8} />
        <Text variant="caption" tone="faint">
          Signed in with Google or Apple? You don’t have a taab password — manage sign-in with that provider.
        </Text>
      </View>
    </Screen>
  );
}
