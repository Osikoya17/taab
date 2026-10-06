import { useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronUp, CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useAuthSession } from '@/features/auth/auth-context';
import type { Transfer } from '@/features/settlements/balances';
import { balancesAfter } from '@/features/settlements/explain';
import { useSettlementExplanation } from '@/features/settlements/queries';
import { formatMoney } from '@/utils/money';

const payments = (n: number) => `${n} ${n === 1 ? 'payment' : 'payments'}`;

/** Smart Settlements, explained briefly: where everyone stands and the fewest payments. */
export default function SettleMathScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user } = useAuthSession();
  const explanation = useSettlementExplanation(id);
  const [showDirect, setShowDirect] = useState(false);

  if (explanation.isPending || explanation.isError) {
    return (
      <Screen header={<AppHeader back title="How it’s worked out" />}>
        <View className="mt-4">
          {explanation.isPending ? <LoadingSkeleton rows={4} /> : <ErrorState title="Couldn’t load the working out." onRetry={() => explanation.refetch()} />}
        </View>
      </Screen>
    );
  }

  const data = explanation.data;
  const isMe = (userId: string) => userId === user?.id;
  const name = (userId: string) => (isMe(userId) ? 'You' : (data.names[userId] ?? 'Someone'));
  const money = (amount: number) => formatMoney(amount, data.currency);
  const simpler = data.direct.length > data.simplified.length;
  const everyoneEven = [...balancesAfter(data.positions, data.simplified).values()].every((amount) => amount === 0);
  const standing = data.positions.filter((p) => p.net !== 0).sort((a, b) => b.net - a.net);

  const transferList = (list: Transfer[]) => (
    <Surface padded={false} className="px-4">
      {list.map((t, i) => (
        <View key={`${t.fromUserId}-${t.toUserId}`}>
          {i > 0 ? <Divider /> : null}
          <View className="flex-row items-center gap-2 py-3" accessible accessibilityLabel={`${name(t.fromUserId)} pays ${name(t.toUserId)} ${money(t.amount)}`}>
            <Text variant="bodyStrong" numberOfLines={1} className="shrink">
              {name(t.fromUserId)}
            </Text>
            <ArrowRight size={14} color={colors.faint} />
            <Text variant="bodyStrong" numberOfLines={1} className="flex-1">
              {name(t.toUserId)}
            </Text>
            <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {money(t.amount)}
            </Text>
          </View>
        </View>
      ))}
    </Surface>
  );

  return (
    <Screen header={<AppHeader back title="How it’s worked out" />}>
      {data.simplified.length === 0 ? (
        <EmptyState illustration="check" title="Everyone’s square" description={`Nobody in ${data.groupName} owes anything right now.`} />
      ) : (
        <>
          <View className="mt-2 items-center">
            <Text variant="title" className="text-center" style={{ fontVariant: ['tabular-nums'] }}>
              {simpler ? `${payments(data.direct.length)} → ${data.simplified.length}` : payments(data.simplified.length)}
            </Text>
            <Text variant="body" tone="muted" className="mt-1 text-center">
              {simpler ? 'Same result, fewer transfers.' : 'Already the fewest payments.'}
            </Text>
          </View>

          <Text variant="label" tone="muted" className="mb-2 mt-7">
            Where everyone stands
          </Text>
          <Surface padded={false} className="px-4">
            {standing.map((p, i) => (
              <View key={p.userId}>
                {i > 0 ? <Divider /> : null}
                <View className="flex-row items-center py-3">
                  <Text variant="bodyStrong" className="flex-1">
                    {name(p.userId)}
                  </Text>
                  <Text variant="body" tone="muted">
                    {p.net > 0 ? (isMe(p.userId) ? 'are owed ' : 'is owed ') : isMe(p.userId) ? 'owe ' : 'owes '}
                  </Text>
                  <Text variant="bodyStrong" tone={p.net > 0 ? 'positive' : 'negative'} style={{ fontVariant: ['tabular-nums'] }}>
                    {money(Math.abs(p.net))}
                  </Text>
                </View>
              </View>
            ))}
          </Surface>
          <Text variant="caption" tone="faint" className="mt-2">
            What each person paid, minus their share, after payments so far.
          </Text>

          <Text variant="label" tone="muted" className="mb-2 mt-7">
            The {payments(data.simplified.length)}
          </Text>
          {transferList(data.simplified)}
          {everyoneEven ? (
            <View className="mt-3 flex-row items-center gap-2">
              <CircleCheck size={16} color={colors.positive} strokeWidth={2} />
              <Text variant="label">Everyone ends at {money(0)}.</Text>
            </View>
          ) : null}

          {simpler ? (
            <>
              <PressableScale
                onPress={() => setShowDirect((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDirect }}
                className="mt-7 flex-row items-center justify-center gap-1.5 py-2">
                <Text variant="label" tone="muted">
                  {showDirect ? 'Hide' : 'Show'} the {payments(data.direct.length)} without simplifying
                </Text>
                {showDirect ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
              </PressableScale>
              {showDirect ? <View className="mt-2">{transferList(data.direct)}</View> : null}
            </>
          ) : null}
        </>
      )}

      {data.waiting > 0 ? (
        <Text variant="caption" tone="faint" className="mt-6 text-center">
          {money(data.waiting)} waiting for confirmation isn’t counted yet.
        </Text>
      ) : null}
      <View className="h-6" />
    </Screen>
  );
}
