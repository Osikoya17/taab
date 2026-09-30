import type { ExpenseListItem } from '@/services/expenses.service';
import type { GroupDetail } from '@/services/groups.service';
import { shortDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

/** Plain-text summary for sharing a taab. Free: the polished report comes with the trip pack. */
export function groupSummaryText(detail: GroupDetail, expenses: ExpenseListItem[]): string {
  const { group } = detail;
  const name = (id: string) => group.members.find((m) => m.userId === id)?.name ?? 'Someone';
  const lines = [`${group.name} — taab summary`, ''];

  if (detail.transfers.length === 0) lines.push('Everyone is settled.');
  else {
    lines.push('To settle up:');
    for (const t of detail.transfers) lines.push(`• ${name(t.fromUserId)} pays ${name(t.toUserId)} ${formatMoney(t.amount, group.currency)}`);
  }

  lines.push('', 'Expenses:');
  for (const { expense } of expenses) {
    const payers = expense.paidBy.map((p) => name(p.userId)).join(' & ');
    lines.push(`• ${shortDate(expense.date)} ${expense.title} — ${formatMoney(expense.amount, expense.currency)} (paid by ${payers})`);
  }
  return lines.join('\n');
}
