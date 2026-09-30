import { View } from 'react-native';

import { PendingBalanceNote } from '@/components/settlements/PendingBalanceNote';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { BalanceBadge } from '@/components/ui/BalanceBadge';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { GroupSummary } from '@/services/groups.service';

/** Row in "Your taabs": stacked avatars, name, members, your balance. */
export function GroupRow({ summary, onPress }: { summary: GroupSummary; onPress: () => void }) {
  const { group, myBalance } = summary;
  const active = group.members.filter((m) => m.status === 'active').length;
  const invited = group.members.length - active;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${group.name}, ${group.members.length} members`}
      className="flex-row items-center gap-4 rounded-card border border-line bg-surface px-4 py-4">
      <View className="w-[58px]">
        <AvatarStack people={group.members.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }))} size={30} max={2} />
      </View>
      <View className="flex-1">
        <Text variant="subheading" numberOfLines={1}>
          {group.name}
        </Text>
        <Text variant="caption" tone="muted" className="mt-0.5">
          {group.members.length} members{invited > 0 ? ` · ${invited} invited` : ''}
        </Text>
        <View className="mt-2">
          <BalanceBadge amount={myBalance} currency={group.currency} groupSettled={summary.isSettled} />
        </View>
        <View className="mt-1.5">
          <PendingBalanceNote paid={summary.myPendingPaid} received={summary.myPendingReceived} currency={group.currency} />
        </View>
      </View>
    </PressableScale>
  );
}
