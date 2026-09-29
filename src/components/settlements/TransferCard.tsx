import { ArrowRight } from 'lucide-react-native';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import type { SettleSuggestion } from '@/services/settlements.service';

export type TransferCardProps = {
  suggestion: SettleSuggestion;
  showGroup?: boolean;
  onRecord: () => void;
  onRemind?: () => void;
};

/** "You owe Gbayin ₦8,500" with the action that resolves it. */
export function TransferCard({ suggestion, showGroup = true, onRecord, onRemind }: TransferCardProps) {
  const colors = useColors();
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
    </Surface>
  );
}
