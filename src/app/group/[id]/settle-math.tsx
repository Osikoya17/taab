import { useLocalSearchParams } from 'expo-router';
import { ArrowRight, CircleCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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

function Step({ n, title, description, children }: { n: number; title: string; description: string; children: ReactNode }) {
  return (
    <View className="mt-8">
      <View className="flex-row items-center gap-2.5">
        <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
          <Text variant="micro" tone="inverse">
            {n}
          </Text>
        </View>
        <Text variant="subheading" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Text variant="caption" tone="muted" className="mb-3 mt-1.5">
        {description}
      </Text>
      {children}
    </View>
  );
}

/** Smart Settlements, explained: the direct debts, where everyone stands, and the fewest payments. */
export default function SettleMathScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user } = useAuthSession();
  const explanation = useSettlementExplanation(id);

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
  const name = (userId: string) => (userId === user?.id ? 'You' : (data.names[userId] ?? 'Someone'));
  const money = (amount: number) => formatMoney(amount, data.currency);
  const simplerBy = data.direct.length - data.simplified.length;
  const everyoneEven = [...balancesAfter(data.positions, data.simplified).values()].every((amount) => amount === 0);
  const involved = data.positions.filter((p) => p.paid || p.share || p.sent || p.received);

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
          <Surface className="mt-2 items-center">
            <Text variant="title" className="text-center" style={{ fontVariant: ['tabular-nums'] }}>
              {simplerBy > 0 ? `${payments(data.direct.length)} → ${data.simplified.length}` : payments(data.simplified.length)}
            </Text>
            <Text variant="body" tone="muted" className="mt-2 text-center">
              {simplerBy > 0
                ? `We simplified this for you: ${payments(simplerBy)} fewer. Everyone still ends up exactly where they should.`
                : 'This is already the fewest payments possible.'}
            </Text>
          </Surface>

          <Step
            n={1}
            title="If everyone paid back directly"
            description="Each person pays back whoever covered them, bill by bill. What two people owe each other cancels out, and confirmed payments are taken off.">
            {transferList(data.direct)}
          </Step>

          <Step n={2} title="Where everyone stands" description="Balance = what you paid − your share + payments you sent − payments you received.">
            <Surface padded={false} className="px-4">
              {involved.map((p, i) => {
                const parts = [`Paid ${money(p.paid)}`, `share ${money(p.share)}`];
                if (p.sent) parts.push(`sent ${money(p.sent)}`);
                if (p.received) parts.push(`received ${money(p.received)}`);
                const verb = p.net > 0 ? (p.userId === user?.id ? 'are owed' : 'is owed') : p.net < 0 ? (p.userId === user?.id ? 'owe' : 'owes') : p.userId === user?.id ? 'are even' : 'is even';
                return (
                  <View key={p.userId}>
                    {i > 0 ? <Divider /> : null}
                    <View className="flex-row items-center gap-3 py-3">
                      <View className="flex-1">
                        <Text variant="bodyStrong">{name(p.userId)}</Text>
                        <Text variant="caption" tone="muted">
                          {parts.join(' · ')}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text variant="bodyStrong" tone={p.net > 0 ? 'positive' : p.net < 0 ? 'negative' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
                          {money(Math.abs(p.net))}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {verb}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Surface>
          </Step>

          <Step
            n={3}
            title="The fewest payments"
            description="The person who owes the most pays the person owed the most, and so on until everyone is even. Nobody pays more than they owe or receives more than they’re owed.">
            {transferList(data.simplified)}
          </Step>

          {everyoneEven ? (
            <View className="mt-4 flex-row items-center gap-2.5 rounded-2xl bg-positive-soft px-4 py-3">
              <CircleCheck size={18} color={colors.positive} strokeWidth={2} />
              <Text variant="label" className="flex-1">
                After these {payments(data.simplified.length)}, everyone is at {money(0)}.
              </Text>
            </View>
          ) : null}
        </>
      )}

      {data.waiting > 0 ? (
        <Text variant="caption" tone="faint" className="mt-6 text-center">
          {money(data.waiting)} recorded as paid is waiting for the receiver to confirm, so it isn’t counted yet.
        </Text>
      ) : null}
      <Text variant="caption" tone="faint" className="mb-4 mt-6 text-center">
        Amounts in {data.currency}, this taab’s currency. Your expense history isn’t changed.
      </Text>
    </Screen>
  );
}
