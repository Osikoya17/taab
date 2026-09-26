import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Repeat, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useGroup } from '@/features/groups/queries';
import { useRecurring, useRemoveRecurring } from '@/features/recurring/queries';
import { toast } from '@/store/toast.store';
import { shortDate } from '@/utils/dates';

const FREQUENCY_COPY = { weekly: 'Every week', monthly: 'Every month', custom: 'Custom' } as const;

export default function RecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const group = useGroup(id);
  const rules = useRecurring(id);
  const remove = useRemoveRecurring(id);
  const nameOf = (userId: string) => group.data?.group.members.find((m) => m.userId === userId)?.name ?? 'Someone';

  return (
    <Screen
      header={<AppHeader back title="Recurring" />}
      footer={<Button label="Add a recurring expense" icon={Plus} onPress={() => router.push({ pathname: '/expense/new', params: { groupId: id, repeat: 'monthly' } })} />}>
      <Text variant="body" tone="muted" className="pt-2">
        Bills like rent, Netflix and electricity that repeat in {group.data?.group.name ?? 'this taab'}.
      </Text>
      <View className="mt-5">
        {rules.isPending ? (
          <LoadingSkeleton rows={2} />
        ) : rules.isError ? (
          <ErrorState title="Couldn’t load recurring expenses." onRetry={() => rules.refetch()} />
        ) : rules.data.length === 0 ? (
          <EmptyState compact illustration="stack" title="Nothing repeating yet" description="Turn on Repeat under More options when you add an expense." />
        ) : (
          <Surface padded={false} className="px-4">
            {rules.data.map((rule, i) => (
              <View key={rule.id}>
                {i > 0 ? <Divider /> : null}
                <View className="flex-row items-center gap-3 py-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-sunken">
                    <Repeat size={17} color={colors.ink} strokeWidth={1.9} />
                  </View>
                  <View className="flex-1">
                    <Text variant="bodyStrong">{rule.title}</Text>
                    <Text variant="caption" tone="muted">
                      {FREQUENCY_COPY[rule.frequency]} · next {shortDate(rule.nextDate)} · {nameOf(rule.paidBy[0]?.userId ?? '')} pays
                    </Text>
                    <Text variant="caption" tone="faint">
                      {rule.autoCreate ? 'Added automatically' : 'Asks before adding'}
                    </Text>
                  </View>
                  <Money amount={rule.amount} currency={rule.currency} size="small" />
                  <IconButton
                    icon={Trash2}
                    variant="plain"
                    size={40}
                    accessibilityLabel={`Stop repeating ${rule.title}`}
                    onPress={() => remove.mutate(rule.id, { onSuccess: () => toast.show(`${rule.title} won’t repeat`) })}
                  />
                </View>
              </View>
            ))}
          </Surface>
        )}
      </View>
    </Screen>
  );
}
