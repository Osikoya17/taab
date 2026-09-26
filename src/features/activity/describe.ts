import type { ActivityEvent } from '@/types/models';
import { formatMoney } from '@/utils/money';

export type ActivityDescription = {
  /** Sentence led by who did it: "Gbayin added Fuel". */
  title: string;
  /** Amount to display on the right, if any. */
  amount?: number;
  /** Direction of money relative to you, so amounts can be read at a glance. */
  tone: 'neutral' | 'positive' | 'negative' | 'muted';
  kind: 'expense' | 'payment' | 'member' | 'group' | 'reminder' | 'removed';
};

/** Turns a raw event into short, social copy from the viewer's perspective. */
export function describeActivity(event: ActivityEvent, meId: string): ActivityDescription {
  const actor = event.actorId === meId ? 'You' : event.actorName;
  const target = event.targetUserId === meId ? 'you' : (event.targetName ?? 'someone');
  const money = event.amount !== undefined && event.currency ? formatMoney(event.amount, event.currency) : '';

  switch (event.type) {
    case 'expense_created':
      return { title: `${actor} added ${event.title ?? 'an expense'}`, amount: event.amount, tone: 'neutral', kind: 'expense' };
    case 'expense_edited':
      return { title: `${actor} edited ${event.title ?? 'an expense'}`, amount: event.amount, tone: 'muted', kind: 'expense' };
    case 'expense_deleted':
      return { title: `${actor} deleted ${event.title ?? 'an expense'}`, amount: event.amount, tone: 'muted', kind: 'removed' };
    case 'payment_recorded': {
      if (event.actorId === meId) {
        return { title: `You settled ${money} with ${event.targetName ?? 'someone'}`, tone: 'negative', kind: 'payment' };
      }
      if (event.targetUserId === meId) {
        return { title: `${event.actorName} paid you ${money}`, tone: 'positive', kind: 'payment' };
      }
      return { title: `${event.actorName} paid ${target} ${money}`, tone: 'muted', kind: 'payment' };
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
