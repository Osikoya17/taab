import { View } from 'react-native';

import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import type { Overview } from '@/features/groups/overview';
import { formatMoney } from '@/utils/money';

/** The answer to "Where do I stand?" — readable in three seconds. */
export function BalanceHero({ overview }: { overview: Overview }) {
  const { currency, summary, others } = overview;
  const settled = summary.owed === 0 && summary.owe === 0;
  const caption = settled ? 'You’re all settled' : summary.net > 0 ? 'You’re owed overall' : summary.net < 0 ? 'You owe overall' : 'You’re even overall';

  return (
    <View>
      <Text variant="label" tone="muted">
        Your balance
      </Text>
      <View className="mt-1.5">
        <Money amount={summary.net} currency={currency} size="hero" tone={summary.net === 0 ? 'ink' : 'auto'} sign="always" animated />
      </View>
      <Text variant="body" tone="muted" className="mt-1">
        {caption}
      </Text>

      <View className="mt-6 flex-row rounded-card border border-line bg-surface">
        <View className="flex-1 px-4 py-3.5">
          <Text variant="caption" tone="muted">
            You are owed
          </Text>
          <Money amount={summary.owed} currency={currency} size="medium" tone={summary.owed > 0 ? 'positive' : 'ink'} animated />
        </View>
        <View className="w-px bg-line" />
        <View className="flex-1 px-4 py-3.5">
          <Text variant="caption" tone="muted">
            You owe
          </Text>
          <Money amount={summary.owe} currency={currency} size="medium" tone={summary.owe > 0 ? 'negative' : 'ink'} animated />
        </View>
      </View>

      {others.length > 0 ? (
        <Text variant="caption" tone="muted" className="mt-2">
          Plus{' '}
          {others
            .map(({ currency: c, summary: s }) => (s.net >= 0 ? `${formatMoney(s.net, c)} owed to you` : `${formatMoney(-s.net, c)} you owe`) + ` in ${c}`)
            .join(', ')}
        </Text>
      ) : null}
    </View>
  );
}
