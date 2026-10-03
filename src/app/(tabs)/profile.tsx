import { useRouter } from 'expo-router';
import {
  Bell,
  CircleHelp,
  Coins,
  Fingerprint,
  Info,
  Landmark,
  LogOut,
  MessageSquareText,
  Palette,
  Send,
  ShieldCheck,
  ScanLine,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { ExtrasCard } from '@/components/billing/ExtrasCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { CURRENCIES } from '@/constants/currencies';
import { EXTRAS_ENABLED } from '@/features/billing/products';
import { hasFeedbackForm, openFeedbackForm } from '@/features/feedback/open-feedback';
import { useAuthActions, useAuthSession } from '@/features/auth/auth-context';
import { useProfile } from '@/features/profile/queries';
import { env } from '@/lib/env';
import { usersService } from '@/services/users.service';
import { hasRemoteApi } from '@/services/api/client';
import { usePreferences } from '@/store/preferences.store';
import { toast } from '@/store/toast.store';
import { monthYear } from '@/utils/dates';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-7">
      <Text variant="label" tone="muted" className="mb-2 px-1" accessibilityRole="header">
        {title}
      </Text>
      <Surface padded={false} className="overflow-hidden">
        {children}
      </Surface>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuthSession();
  const actions = useAuthActions();
  const { data: profile } = useProfile();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const appearance = usePreferences((s) => s.appearance);
  const biometricLock = usePreferences((s) => s.biometricLock);

  const name = profile?.name ?? user?.fullName ?? '';
  const email = profile?.email ?? user?.email ?? '';
  const since = profile?.createdAt ?? user?.createdAt;

  async function signOut() {
    setBusy(true);
    try {
      await actions.signOut();
    } catch {
      toast.error('Couldn’t sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await usersService.deleteAccountData();
      if (hasRemoteApi) { await actions.signOut(); return; }
      const result = await actions.deleteAccount();
      if (result.status === 'error') toast.error(result.message);
    } catch {
      toast.error('We couldn’t delete your account right now.', 'Check your connection and try again.');
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Screen withTabBar header={<AppHeader large title="Profile" />}>
      <View className="flex-row items-center gap-4 pt-1">
        <Avatar name={name || email} uri={profile?.avatarUrl ?? user?.imageUrl} seed={user?.id} size={64} />
        <View className="flex-1">
          <Text variant="heading" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="body" tone="muted" numberOfLines={1}>
            {email}
          </Text>
          {since ? (
            <Text variant="caption" tone="faint" className="mt-0.5">
              Member since {monthYear(since)}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-6">
        {EXTRAS_ENABLED ? <ExtrasCard onPress={() => router.push('/extras')} /> : null}
      </View>

      <Section title="Account">
        <ListRow icon={UserRound} title="Personal details" onPress={() => router.push('/settings/personal')} />
        <Divider inset={60} />
        <ListRow
          icon={Coins}
          title="Currency"
          value={profile ? `${profile.defaultCurrency} ${CURRENCIES[profile.defaultCurrency].symbol}` : undefined}
          onPress={() => router.push('/settings/currency')}
        />
        <Divider inset={60} />
        <ListRow icon={Landmark} title="Bank account" onPress={() => router.push('/settings/payout')} />
        <Divider inset={60} />
        <ListRow icon={Bell} title="Notifications" onPress={() => router.push('/settings/notifications')} />
        <Divider inset={60} />
        <ListRow icon={Palette} title="Appearance" value={appearance === 'system' ? 'System' : appearance === 'dark' ? 'Dark' : 'Light'} onPress={() => router.push('/settings/appearance')} />
      </Section>

      <Section title="taab">
        {EXTRAS_ENABLED ? (
          <>
            <ListRow icon={ScanLine} title="Extras" onPress={() => router.push('/extras')} />
            <Divider inset={60} />
          </>
        ) : null}
        <ListRow
          icon={Send}
          title="Invite friends"
          onPress={() =>
            Share.share({ message: `I use taab to split bills without the awkward maths. Join me: ${env.inviteBaseUrl}` }).catch(() => undefined)
          }
        />
        <Divider inset={60} />
        <ListRow icon={CircleHelp} title="Help" onPress={() => router.push('/settings/help')} />
        {hasFeedbackForm ? (
          <>
            <Divider inset={60} />
            <ListRow
              icon={MessageSquareText}
              title="Send feedback"
              onPress={() => openFeedbackForm().catch(() => toast.error('Couldn’t open the form', 'Check your connection and try again.'))}
            />
          </>
        ) : null}
        <Divider inset={60} />
        <ListRow icon={Info} title="About" onPress={() => router.push('/settings/about')} />
      </Section>

      <Section title="Security">
        <ListRow
          icon={Fingerprint}
          title="App lock"
          value={Platform.OS === 'web' ? undefined : biometricLock ? 'On' : 'Off'}
          onPress={() => router.push('/settings/security')}
        />
        <Divider inset={60} />
        <ListRow icon={ShieldCheck} title="Manage account" onPress={() => router.push('/settings/account')} />
        <Divider inset={60} />
        <ListRow icon={LogOut} title="Sign out" showChevron={false} onPress={() => setConfirmSignOut(true)} />
      </Section>

      <Section title="Danger zone">
        <ListRow icon={Trash2} title="Delete account" destructive showChevron={false} onPress={() => setConfirmDelete(true)} />
      </Section>

      <BottomSheet visible={confirmSignOut} onClose={() => setConfirmSignOut(false)} title="Sign out of taab?" description="Your taabs stay safe — sign back in any time.">
        <View className="gap-2">
          <Button label="Sign out" onPress={signOut} loading={busy} />
          <Button label="Cancel" variant="ghost" onPress={() => setConfirmSignOut(false)} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        description="This permanently removes your account and personal details. Shared expense records are retained without your name so other members can still settle their balances. This can’t be undone.">
        <View className="gap-2">
          <Button label="Delete my account" variant="danger" onPress={deleteAccount} loading={busy} />
          <Button label="Keep my account" variant="ghost" onPress={() => setConfirmDelete(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
