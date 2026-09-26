import { View } from 'react-native';

import { AvatarStack } from '@/components/ui/AvatarStack';
import { BalanceBadge } from '@/components/ui/BalanceBadge';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import type { GroupSummary } from '@/services/groups.service';
import { updatedAgo } from '@/utils/dates';

/** Home "Recent taabs" card: name, people, your position, freshness. */
export function GroupCard({ summary, onPress }: { summary: GroupSummary; onPress: () => void }) {
  const { group, myBalance, isSettled, lastActivityAt } = summary;
  const count = group.members.length;

  return (
    <Surface onPress={onPress} accessibilityLabel={`${group.name}, ${count} people`} className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="subheading" numberOfLines={1}>
            {group.name}
          </Text>
          <Text variant="caption" tone="muted" className="mt-0.5">
            {count} {count === 1 ? 'person' : 'people'} · {updatedAgo(lastActivityAt)}
          </Text>
        </View>
        <AvatarStack people={group.members.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }))} size={26} max={3} />
      </View>
      <View className="flex-row items-center justify-between">
        <BalanceBadge amount={myBalance} currency={group.currency} groupSettled={isSettled} />
        <Text variant="micro" tone="faint">
          {isSettled ? 'Settled' : 'Unsettled'}
        </Text>
      </View>
    </Surface>
  );
}
