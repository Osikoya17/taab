import { Repeat } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useResolveDue } from '@/features/recurring/queries';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast.store';
import type { RecurringExpense } from '@/types/models';
import { useDisplayCurrency } from '@/features/currency/display';

/** "Netflix is due — add it?" for recurring rules that ask first. */
export function DueRecurringCard({ rule }: { rule: RecurringExpense }) {
  const colors = useColors();
  const resolve = useResolveDue();
  const { format } = useDisplayCurrency();
  const busy = resolve.isPending;

  return (
    <Surface className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-sunken">
          <Repeat size={17} color={colors.ink} strokeWidth={1.9} />
        </View>
        <View className="flex-1">
          <Text variant="bodyStrong">{rule.title} is due</Text>
          <Text variant="caption" tone="muted">
            {format(rule.amount, rule.currency)} · repeats {rule.frequency}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button
          label="Skip this time"
          size="md"
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onPress={() => resolve.mutate({ id: rule.id, action: 'skip' })}
        />
        <Button
          label="Add it"
          size="md"
          className="flex-1"
          loading={busy}
          onPress={() =>
            resolve.mutate(
              { id: rule.id, action: 'confirm' },
              {
                onSuccess: () => {
                  haptics.success();
                  toast.success(`${rule.title} added`);
                },
              },
            )
          }
        />
      </View>
    </Surface>
  );
}
