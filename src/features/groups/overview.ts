import { summarizeForUser, type MoneySummary } from '@/features/settlements/balances';
import type { GroupSummary } from '@/services/groups.service';
import type { CurrencyCode } from '@/types/models';

export type Overview = {
  currency: CurrencyCode;
  summary: MoneySummary;
  /** Balances in other currencies can't be added together, so they're listed separately. */
  others: { currency: CurrencyCode; summary: MoneySummary }[];
};

/** Where do I stand? Rolls group balances up for Home. */
export function buildOverview(groups: GroupSummary[], userId: string, preferred: CurrencyCode): Overview {
  const byCurrency = summarizeForUser(
    userId,
    groups.map((g) => ({ currency: g.group.currency, balances: new Map([[userId, g.myBalance]]) })),
  );
  const currency = byCurrency.has(preferred) || byCurrency.size === 0 ? preferred : [...byCurrency.keys()][0];
  return {
    currency,
    summary: byCurrency.get(currency) ?? { owed: 0, owe: 0, net: 0 },
    others: [...byCurrency.entries()]
      .filter(([c, s]) => c !== currency && (s.owed > 0 || s.owe > 0))
      .map(([c, summary]) => ({ currency: c, summary })),
  };
}
