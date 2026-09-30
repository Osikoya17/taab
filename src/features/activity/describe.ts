import { summarizeChanges } from '@/features/expenses/change-copy';
import type { ActivityEvent, CurrencyCode, MinorUnits } from '@/types/models';
import { formatMoney } from '@/utils/money';

export type ActivityDescription = {
  /** Sentence led by who did it: "Gbayin added Fuel". */
  title: string;
  /** A second line with more detail, e.g. what an edit changed. */
  detail?: string;
  /** Amount to display on the right, if any. */
  amount?: number;
  /** Direction of money relative to you, so amounts can be read at a glance. */
  tone: 'neutral' | 'positive' | 'negative' | 'muted';
  kind: 'expense' | 'payment' | 'member' | 'group' | 'reminder' | 'removed';
};

const MONEY_EVENTS: ActivityEvent['type'][] = ['expense_created', 'expense_edited', 'expense_deleted', 'payment_recorded', 'payment_confirmed', 'payment_declined'];

/** Expenses and payments: what the Expenses tab and Home's recent list show. */
export function isMoneyEvent(event: ActivityEvent): boolean {
  return MONEY_EVENTS.includes(event.type);
}

/**
 * Turns a raw event into short, social copy from the viewer's perspective.
 * `format` lets the screen show amounts in the viewer's display currency.
 */
export function describeActivity(
  event: ActivityEvent,
  meId: string,
  format: (amount: MinorUnits, currency: CurrencyCode) => string = formatMoney,
): ActivityDescription {
  const actor = event.actorId === meId ? 'You' : event.actorName;
  const target = event.targetUserId === meId ? 'you' : (event.targetName ?? 'someone');
  const money = event.amount !== undefined && event.currency ? format(event.amount, event.currency) : '';

  switch (event.type) {
    case 'expense_created':
      return { title: `${actor} added ${event.title ?? 'an expense'}`, amount: event.amount, tone: 'neutral', kind: 'expense' };
    case 'expense_edited': {
      const title = event.title ?? 'an expense';
      const amountChange = event.changes?.find((c) => c.field === 'amount');
      if (amountChange?.field === 'amount' && event.currency) {
        const rest = summarizeChanges(event.changes!.filter((c) => c.field !== 'amount' && c.field !== 'paidBy' && c.field !== 'split'));
        return {
          title: `${actor} changed ${title} from ${format(amountChange.from, event.currency)} to ${format(amountChange.to, event.currency)}`,
          detail: rest ? `Also ${rest.charAt(0).toLowerCase()}${rest.slice(1)}` : undefined,
          amount: event.amount, tone: 'muted', kind: 'expense',
        };
      }
      return { title: `${actor} edited ${title}`, detail: summarizeChanges(event.changes ?? []), amount: event.amount, tone: 'muted', kind: 'expense' };
    }
    case 'expense_deleted':
      return { title: `${actor} deleted ${event.title ?? 'an expense'}`, amount: event.amount, tone: 'muted', kind: 'removed' };
    // The payer recorded it; the receiver hasn't answered yet (or it predates confirmation).
    case 'payment_recorded': {
      if (event.actorId === meId) return { title: `You recorded paying ${event.targetName ?? 'someone'} ${money}`, tone: 'muted', kind: 'payment' };
      if (event.targetUserId === meId) return { title: `${event.actorName} says they paid you ${money}`, tone: 'muted', kind: 'payment' };
      return { title: `${event.actorName} recorded paying ${target} ${money}`, tone: 'muted', kind: 'payment' };
    }
    // The receiver is the actor; the payer is the target.
    case 'payment_confirmed': {
      if (event.actorId === meId) return { title: `You confirmed ${money} from ${event.targetName ?? 'someone'}`, tone: 'positive', kind: 'payment' };
      if (event.targetUserId === meId) return { title: `${event.actorName} confirmed your ${money} payment`, tone: 'negative', kind: 'payment' };
      return { title: `${event.actorName} confirmed ${money} from ${target}`, tone: 'muted', kind: 'payment' };
    }
    case 'payment_declined': {
      if (event.actorId === meId) return { title: `You said ${money} from ${event.targetName ?? 'someone'} didn’t arrive`, tone: 'muted', kind: 'payment' };
      if (event.targetUserId === meId) return { title: `${event.actorName} says your ${money} payment didn’t arrive`, tone: 'muted', kind: 'payment' };
      return { title: `${event.actorName} didn’t receive ${money} from ${target}`, tone: 'muted', kind: 'payment' };
    }
    case 'member_joined':
      return { title: `${actor} joined ${event.groupName}`, tone: 'neutral', kind: 'member' };
    case 'group_created':
      return { title: `${actor} created ${event.groupName}`, tone: 'neutral', kind: 'group' };
    case 'reminder_sent':
      if (event.actorId === meId) return { title: `You reminded ${event.targetName ?? 'someone'}`, amount: event.amount, tone: 'muted', kind: 'reminder' };
      if (event.targetUserId === meId) return { title: `${event.actorName} sent you a reminder`, amount: event.amount, tone: 'negative', kind: 'reminder' };
      return { title: `${event.actorName} reminded ${target}`, tone: 'muted', kind: 'reminder' };
  }
}
