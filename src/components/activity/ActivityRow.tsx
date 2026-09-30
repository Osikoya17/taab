import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Money } from '@/components/ui/Money';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { describeActivity } from '@/features/activity/describe';
import { useDisplayCurrency } from '@/features/currency/display';
import type { ActivityEvent } from '@/types/models';
import { relativeTime } from '@/utils/dates';

export type ActivityRowProps = {
  event: ActivityEvent;
  meId: string;
  /** Hide the group name when already inside a group. */
  showGroup?: boolean;
  onPress?: (event: ActivityEvent) => void;
};

export function ActivityRow({ event, meId, showGroup = true, onPress }: ActivityRowProps) {
  const { format } = useDisplayCurrency();
  const d = describeActivity(event, meId, format);
  const meta = [showGroup ? event.groupName : null, relativeTime(event.createdAt)].filter(Boolean).join(' • ');
  const moneyTone = d.tone === 'positive' ? 'positive' : d.tone === 'negative' ? 'negative' : d.tone === 'muted' ? 'muted' : 'ink';

  const body = (
    <View className="flex-row items-center gap-3 py-3">
      <Avatar name={event.actorName} seed={event.actorId} size={40} />
      <View className="flex-1">
        <Text variant="bodyStrong" numberOfLines={2} className={d.kind === 'removed' ? 'line-through' : undefined}>
          {d.title}
        </Text>
        {d.detail ? (
          <Text variant="caption" className="mt-0.5" numberOfLines={1}>
            {d.detail}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted" className="mt-0.5">
          {meta}
        </Text>
      </View>
      {d.amount !== undefined && event.currency ? <Money amount={d.amount} currency={event.currency} size="small" tone={moneyTone} /> : null}
    </View>
  );

  if (!onPress || !event.expenseId || d.kind === 'removed') return body;
  return (
    <PressableScale onPress={() => onPress(event)} accessibilityLabel={[d.title, d.detail, meta].filter(Boolean).join(', ')} pressedScale={0.99}>
      {body}
    </PressableScale>
  );
}
