import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { describeChange } from '@/features/expenses/change-copy';
import { useExpenseHistory } from '@/features/expenses/queries';
import type { Expense, Group } from '@/types/models';
import { relativeTime } from '@/utils/dates';

type Line = { id: string; actorId: string; actorName: string; at: string; headline: string; details: string[] };

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Who added the expense and every change since, with the exact before and
 * after values. Amounts stay in the taab's own currency so the record is exact.
 */
export function ExpenseHistory({ expense, group, meId }: { expense: Expense; group: Group; meId: string }) {
  const history = useExpenseHistory(expense.id);
  const memberName = (userId: string) => group.members.find((m) => m.userId === userId)?.name ?? 'Someone';
  const nameInSentence = (userId: string) => (userId === meId ? 'you' : memberName(userId));
  const actorLabel = (userId: string, name: string) => (userId === meId ? 'You' : name);

  const events = history.data ?? [];
  const lines: Line[] = events.map((event) => {
    const actor = actorLabel(event.actorId, event.actorName);
    if (event.type === 'expense_created') return { id: event.id, actorId: event.actorId, actorName: event.actorName, at: event.createdAt, headline: `${actor} added this`, details: [] };
    const phrases = (event.changes ?? []).map((c) => describeChange(c, { currency: expense.currency, nameOf: nameInSentence }));
    return phrases.length === 1
      ? { id: event.id, actorId: event.actorId, actorName: event.actorName, at: event.createdAt, headline: `${actor} ${phrases[0]}`, details: [] }
      : { id: event.id, actorId: event.actorId, actorName: event.actorName, at: event.createdAt, headline: `${actor} edited this`, details: phrases.map(capitalize) };
  });
  // Expenses added before history was kept still show who added them.
  if (history.isSuccess && !events.some((e) => e.type === 'expense_created')) {
    const name = memberName(expense.createdBy);
    lines.unshift({ id: 'created', actorId: expense.createdBy, actorName: name, at: expense.createdAt, headline: `${actorLabel(expense.createdBy, name)} added this`, details: [] });
  }

  if (!history.isSuccess) return null;
  return (
    <>
      <Text variant="label" tone="muted" className="mb-2 mt-6">
        History
      </Text>
      <Surface padded={false} className="px-4">
        {lines.map((line, i) => (
          <View key={line.id}>
            {i > 0 ? <Divider inset={42} /> : null}
            <View className="flex-row gap-3 py-3" accessible accessibilityLabel={[line.headline, ...line.details, relativeTime(line.at)].join('. ')}>
              <Avatar name={line.actorName} seed={line.actorId} size={30} />
              <View className="flex-1">
                <Text variant="body">{line.headline}</Text>
                {line.details.map((detail) => (
                  <Text key={detail} variant="caption" tone="muted" className="mt-0.5">
                    {detail}
                  </Text>
                ))}
                <Text variant="caption" tone="faint" className="mt-0.5">
                  {relativeTime(line.at)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Surface>
      <Text variant="caption" tone="faint" className="mt-2">
        Everyone in this taab can see this history.
      </Text>
    </>
  );
}
