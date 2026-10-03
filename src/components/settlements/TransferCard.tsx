import { ArrowRight } from 'lucide-react-native';
import { View } from 'react-native';

import { PayToCard } from '@/components/payouts/PayToCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { PressableScale } from '@/components/ui/PressableScale';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useDisplayCurrency } from '@/features/currency/display';
import type { SettleSuggestion } from '@/services/settlements.service';

export type TransferCardProps = {
  suggestion: SettleSuggestion;
  showGroup?: boolean;
  onRecord: () => void;
  onRemind?: () => void;
  /** Opens the working out for this taab. */
  onExplain?: () => void;
};

/** "You owe Gbayin ₦8,500" with the action that resolves it. */
export function TransferCard({ suggestion, showGroup = true, onRecord, onRemind, onExplain }: TransferCardProps) {
  const colors = useColors();
  const { format } = useDisplayCurrency();
  const youOwe = suggestion.direction === 'you_owe';
  const other = youOwe ? { id: suggestion.toUserId, name: suggestion.toName } : { id: suggestion.fromUserId, name: suggestion.fromName };
  const headline = youOwe ? `You owe ${other.name}` : `${other.name} owes you`;

  return (
    <Surface className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center">
          <Avatar name={youOwe ? 'You' : other.name} seed={youOwe ? 'me' : other.id} size={36} />
          <View className="mx-1.5">
            <ArrowRight size={14} color={colors.faint} />
          </View>
          <Avatar name={youOwe ? other.name : 'You'} seed={youOwe ? other.id : 'me'} size={36} />
        </View>
        <View className="flex-1">
          <Text variant="bodyStrong">{headline}</Text>
          {showGroup ? (
            <Text variant="caption" tone="muted">
              {suggestion.groupName}
            </Text>
          ) : null}
        </View>
        <Money amount={suggestion.amount} currency={suggestion.currency} size="medium" tone={youOwe ? 'negative' : 'positive'} />
      </View>
      {youOwe && suggestion.payTo ? <PayToCard account={suggestion.payTo} name={other.name} compact /> : null}
      {suggestion.pendingAmount > 0 ? (
        <View className="rounded-2xl bg-accent-soft px-3 py-2">
          <Text variant="caption">
            {youOwe
              ? `You’ve recorded ${format(suggestion.pendingAmount, suggestion.currency)} that’s waiting for ${other.name} to confirm.`
              : `${other.name} says they paid ${format(suggestion.pendingAmount, suggestion.currency)}. Confirm it on Home or in the taab.`}
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-2">
        {youOwe ? (
          <Button label="Record payment" size="md" onPress={onRecord} className="flex-1" />
        ) : (
          <>
            <Button label="Mark as paid" size="md" variant="secondary" onPress={onRecord} className="flex-1" />
            {onRemind ? <Button label="Send reminder" size="md" onPress={onRemind} className="flex-1" /> : null}
          </>
        )}
      </View>
      {onExplain ? (
        <PressableScale onPress={onExplain} accessibilityRole="button" hitSlop={8} className="-mt-1 items-center py-1">
          <Text variant="caption" tone="muted">
            How was this worked out?
          </Text>
        </PressableScale>
      ) : null}
    </Surface>
  );
}
