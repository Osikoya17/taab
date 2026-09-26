import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuthSession } from '@/features/auth/auth-context';
import { useProfile } from '@/features/profile/queries';
import { groupsService } from '@/services/groups.service';
import { isServiceError } from '@/services/api/errors';
import { usePreferences } from '@/store/preferences.store';

export default function JoinGroupScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isSignedIn } = useAuthSession();
  const profile = useProfile();
  const router = useRouter();
  const client = useQueryClient();
  const setPendingInvite = usePreferences((s) => s.setPendingInvite);
  const join = useMutation({
    mutationFn: () => groupsService.joinGroup(token),
    onSuccess: async (group) => {
      setPendingInvite(null);
      await client.invalidateQueries();
      router.replace(`/group/${group.id}`);
    },
  });
  const ready = isSignedIn && profile.data?.setupComplete;
  function continueToAccount() {
    setPendingInvite(token);
    router.push(isSignedIn ? '/(onboarding)/setup' : '/(auth)/sign-in');
  }
  return (
    <Screen header={<AppHeader title="Join a taab" />}>
      <View className="gap-5 pt-8">
        <Text variant="heading">You’ve been invited</Text>
        <Text variant="body" tone="muted">Join this group to share expenses and keep track of balances. Invite links expire after seven days.</Text>
        {join.isError ? <Text tone="negative">{isServiceError(join.error) && join.error.code === 'limit_reached' ? 'You’ve reached your group limit. Leave a settled group before joining.' : 'This invite could not be accepted. Check your connection or ask for a new link.'}</Text> : null}
        <Button label={ready ? 'Join taab' : isSignedIn ? 'Finish account setup' : 'Sign in to join'} loading={join.isPending} onPress={ready ? () => join.mutate() : continueToAccount} />
        <Button label="Not now" variant="ghost" onPress={() => { setPendingInvite(null); router.replace('/'); }} />
      </View>
    </Screen>
  );
}
