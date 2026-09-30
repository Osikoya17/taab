import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { View } from 'react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { PressableScale } from '@/components/ui/PressableScale';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import type { PendingPayment } from '@/services/settlements.service';
import { relativeTime } from '@/utils/dates';

/** Payments you've recorded that the other person hasn't confirmed yet. */
export function AwaitingConfirmationList({ payments }: { payments: PendingPayment[] }) {
  const colors = useColors();
  const router = useRouter();

  return (
    <Surface padded={false} className="px-4 py-1">
      <Text variant="label" tone="muted" className="pb-1 pt-3">
        Waiting for confirmation
      </Text>
      {payments.map(({ settlement, toName, groupName }, i) => (
        <View key={settlement.id}>
          {i > 0 ? <Divider inset={52} /> : null}
          <PressableScale
            onPress={() => router.push(`/group/${settlement.groupId}`)}
            accessibilityLabel={`You paid ${toName}, waiting for ${toName} to confirm. ${groupName}`}
            pressedScale={0.99}
            className="flex-row items-center gap-3 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
              <Clock size={17} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View className="flex-1">
              <Text variant="bodyStrong" numberOfLines={1}>
                You paid {toName}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1} className="mt-0.5">
                Waiting for {toName} to confirm · {groupName} · {relativeTime(settlement.createdAt)}
              </Text>
            </View>
            <Money amount={settlement.amount} currency={settlement.currency} size="small" tone="muted" />
          </PressableScale>
        </View>
      ))}
      <Text variant="caption" tone="faint" className="pb-3">
        Your balance updates once they confirm.
      </Text>
    </Surface>
  );
}
