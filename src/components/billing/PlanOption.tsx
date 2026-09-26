import { View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import type { PlanPrice } from '@/features/billing/products';
import { formatMoney } from '@/utils/money';
import { cx } from '@/utils/cx';

export function PlanOption({ price, selected, onSelect, badge }: { price: PlanPrice; selected: boolean; onSelect: () => void; badge?: string }) {
  const perMonth = price.interval === 'year' ? Math.round(price.amount / 12) : price.amount;
  return (
    <PressableScale
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${price.label}, ${formatMoney(price.amount, price.currency)} per ${price.interval}${badge ? `, ${badge}` : ''}`}
      className={cx('flex-1 rounded-card border bg-surface p-4', selected ? 'border-ink' : 'border-line')}
      style={selected ? { borderWidth: 1.5 } : undefined}>
      <View className="flex-row items-center justify-between">
        <Text variant="label">{price.label}</Text>
        <View
          className="h-5 w-5 items-center justify-center rounded-full border"
          style={{ borderColor: selected ? colors.ink : colors.lineStrong }}>
          {selected ? <View className="h-2.5 w-2.5 rounded-full bg-ink" /> : null}
        </View>
      </View>
      <Text variant="heading" className="mt-3">
        {formatMoney(price.amount, price.currency)}
      </Text>
      <Text variant="caption" tone="muted">
        {price.interval === 'year' ? `${formatMoney(perMonth, price.currency)}/month, billed yearly` : 'per month'}
      </Text>
      {badge ? (
        <View className="mt-3 self-start rounded-full bg-accent-soft px-2.5 py-1">
          <Text variant="micro" style={{ color: '#7A5A22' }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}
