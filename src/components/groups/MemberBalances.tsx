import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import type { MemberBalance } from '@/services/groups.service';
import type { CurrencyCode } from '@/types/models';

/**
 * Simple per-member balance bars. Length shows size, colour shows direction,
 * and a word ("gets back" / "owes") makes it readable without colour.
 */
export function MemberBalances({ balances, currency, meId }: { balances: MemberBalance[]; currency: CurrencyCode; meId: string }) {
  const max = Math.max(1, ...balances.map((b) => Math.abs(b.amount)));
  const sorted = [...balances].sort((a, b) => (a.userId === meId ? -1 : b.userId === meId ? 1 : b.amount - a.amount));

  return (
    <View className="gap-3.5">
      {sorted.map((b) => {
        const name = b.userId === meId ? 'You' : b.name;
        const fill = Math.abs(b.amount) / max;
        const isMe = b.userId === meId;
        const status = b.amount > 0 ? (isMe ? 'get back' : 'gets back') : b.amount < 0 ? (isMe ? 'owe' : 'owes') : 'settled';
        return (
          <View key={b.userId} className="flex-row items-center gap-3" accessible accessibilityLabel={`${name} ${status}`}>
            <Avatar name={b.name} uri={b.avatarUrl} seed={b.userId} size={32} />
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-baseline justify-between">
                <Text variant="label" numberOfLines={1}>
                  {name}
                  <Text variant="caption" tone="faint">
                    {'  '}
                    {status}
                  </Text>
                </Text>
                <Money amount={b.amount} currency={currency} size="small" tone="auto" sign="always" />
              </View>
              <View className="h-1 overflow-hidden rounded-full bg-sunken">
                <View
                  style={{
                    width: `${Math.max(fill * 100, b.amount === 0 ? 0 : 3)}%`,
                    height: '100%',
                    borderRadius: 999,
                    backgroundColor: b.amount >= 0 ? colors.positive : colors.negative,
                    opacity: 0.75,
                  }}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
