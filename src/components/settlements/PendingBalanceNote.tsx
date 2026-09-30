import { Clock } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useDisplayCurrency } from '@/features/currency/display';
import type { CurrencyCode, MinorUnits } from '@/types/models';

/**
 * Sits under a balance so a recorded-but-unconfirmed payment never looks
 * like it was ignored: "₦4,500 paid · waiting for confirmation".
 */
export function PendingBalanceNote({ paid = 0, received = 0, currency }: { paid?: MinorUnits; received?: MinorUnits; currency: CurrencyCode }) {
  const colors = useColors();
  const { format } = useDisplayCurrency();
  if (paid <= 0 && received <= 0) return null;
  const lines = [
    ...(paid > 0 ? [`${format(paid, currency)} paid · waiting for confirmation`] : []),
    ...(received > 0 ? [`${format(received, currency)} received · waiting for you to confirm`] : []),
  ];
  return (
    <View className="flex-row items-center gap-1.5" accessible accessibilityLabel={lines.join('. ')}>
      <Clock size={12} color={colors.muted} strokeWidth={2} />
      <Text variant="caption" tone="muted" numberOfLines={2} className="flex-1">
        {lines.join(' · ')}
      </Text>
    </View>
  );
}
