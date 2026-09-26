import type { RecurringFrequency } from '@/types/models';

/** UTC dates keep a bill's schedule stable when devices use different time zones. */
export function nextOccurrence(from: string, frequency: RecurringFrequency, intervalDays = 30, anchorDay?: number): string {
  const date = new Date(from);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid recurring date');
  if (frequency === 'monthly') {
    const day = anchorDay ?? date.getUTCDate();
    if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError('Invalid anchor day');
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  } else {
    const days = frequency === 'weekly' ? 7 : intervalDays;
    if (!Number.isInteger(days) || days < 1 || days > 3650) throw new RangeError('Invalid recurring interval');
    date.setUTCDate(date.getUTCDate() + days);
  }
  return date.toISOString();
}
