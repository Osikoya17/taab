import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { Copy, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { MemberInviter, type PendingInvite } from '@/components/groups/MemberInviter';
import { SheetHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useGroup, useInviteMembers } from '@/features/groups/queries';
import { haptics } from '@/lib/haptics';
import { groupsService } from '@/services/groups.service';
import { toast } from '@/store/toast.store';
import { useGoBack } from '@/hooks/use-go-back';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
  const group = useGroup(id);
  const invite = useInviteMembers(id);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const name = group.data?.group.name ?? 'this taab';

  async function shareLink(copy: boolean) {
    try {
      const link = await groupsService.getInviteLink(id);
      if (copy) {
        await Clipboard.setStringAsync(link);
        toast.show('Invite link copied');
      } else {
        await Share.share({ message: `Join ${name} on taab so we can split bills easily: ${link}` });
      }
    } catch {
      toast.error('Couldn’t create an invite link', 'Check your connection and try again.');
    }
  }

  async function send() {
    try {
      await invite.mutateAsync(invites.map(({ key: _key, label: _label, detail: _detail, ...i }) => i));
      haptics.success();
      toast.success(invites.length === 1 ? `${invites[0].label} added` : `${invites.length} people added`);
      goBack(`/group/${id}`);
    } catch {
      toast.error('Couldn’t add people right now', 'Check your connection and try again.');
    }
  }

  return (
    <Screen
      keyboard
      safeTop={false}
      header={<SheetHeader title="Invite people" onCancel={() => goBack(`/group/${id}`)} />}
      footer={<Button label={invites.length ? `Add ${invites.length} ${invites.length === 1 ? 'person' : 'people'}` : 'Add people'} disabled={invites.length === 0} loading={invite.isPending} onPress={send} />}>
      <View className="gap-6 pt-3">
        <Surface className="gap-3">
          <View>
            <Text variant="bodyStrong">Share an invite link</Text>
            <Text variant="caption" tone="muted" className="mt-0.5">
              Anyone with the link can join {name}.
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button label="Share link" icon={Share2} size="md" className="flex-1" onPress={() => shareLink(false)} />
            <Button label="Copy" icon={Copy} size="md" variant="secondary" className="flex-1" onPress={() => shareLink(true)} />
          </View>
        </Surface>
        <View>
          <Text variant="label" tone="muted" className="mb-2">
            Or add people directly
          </Text>
          <MemberInviter value={invites} onChange={setInvites} excludeIds={group.data?.group.members.map((m) => m.userId)} />
        </View>
      </View>
    </Screen>
  );
}
