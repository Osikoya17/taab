import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors } from '@/constants/theme';
import { useDisplayCurrency } from '@/features/currency/display';
import type { CurrencyCode, MinorUnits } from '@/types/models';
import { formatMoney } from '@/utils/money';
import { cx } from '@/utils/cx';

import { Text } from './Text';

export type BalanceBadgeProps = {
  amount: MinorUnits;
  currency: CurrencyCode;
  /** `inline` is plain coloured text; `pill` adds a soft background. */
  appearance?: 'inline' | 'pill';
  /** Whether everyone in the group is square, not just you. Defaults to true. */
  groupSettled?: boolean;
};

/**
 * "You're owed ₦18,500" / "You owe ₦4,200" / "All settled". The words carry
 * the meaning so colour is never the only signal. When you're square but
 * others in the group aren't, say so rather than claiming the group is settled.
 */
export function balanceCopy(amount: MinorUnits, currency: CurrencyCode, groupSettled = true, format: MoneyFormatter = formatMoney) {
  if (amount > 0) return `You’re owed ${format(amount, currency)}`;
  if (amount < 0) return `You owe ${format(-amount, currency)}`;
  return groupSettled ? 'All settled' : 'You’re settled up';
}

type MoneyFormatter = (amount: MinorUnits, currency: CurrencyCode) => string;

export function BalanceBadge({ amount, currency, appearance = 'inline', groupSettled = true }: BalanceBadgeProps) {
  const colors = useColors();
  const { format } = useDisplayCurrency();
  const tone = amount > 0 ? 'positive' : amount < 0 ? 'negative' : 'muted';
  const copy = balanceCopy(amount, currency, groupSettled, format);

  if (appearance === 'inline') {
    return (
      <View className="flex-row items-center gap-1">
        {amount === 0 ? <Check size={13} color={colors.muted} strokeWidth={2.4} /> : null}
        <Text variant="label" tone={tone}>
          {copy}
        </Text>
      </View>
    );
  }

  return (
    <View
      className={cx(
        'flex-row items-center gap-1 self-start rounded-full px-2.5 py-1',
        amount > 0 && 'bg-positive-soft',
        amount < 0 && 'bg-negative-soft',
        amount === 0 && 'bg-sunken',
      )}>
      {amount === 0 ? <Check size={12} color={colors.muted} strokeWidth={2.4} /> : null}
      <Text variant="micro" tone={tone}>
        {copy}
      </Text>
    </View>
  );
}
