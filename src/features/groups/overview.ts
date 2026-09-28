import { convertMinor, type ExchangeRates } from '@/features/currency/rates';
import { summarizeForUser, type MoneySummary } from '@/features/settlements/balances';
import type { GroupSummary } from '@/services/groups.service';
import type { CurrencyCode } from '@/types/models';

export type Overview = {
  currency: CurrencyCode;
  summary: MoneySummary;
  /** Balances in other currencies, listed separately when they can't be converted. */
  others: { currency: CurrencyCode; summary: MoneySummary }[];
  /** Set when balances in other currencies were folded into the total at today's rates. */
  converted?: { currencies: CurrencyCode[]; updatedAt: string };
};

/**
 * Where do I stand? Rolls group balances up for Home. With exchange rates,
 * everything is totalled in the preferred currency; without them (offline,
 * or the provider is down) other currencies are listed on their own.
 */
export function buildOverview(groups: GroupSummary[], userId: string, preferred: CurrencyCode, rates?: ExchangeRates | null): Overview {
  const byCurrency = summarizeForUser(
    userId,
    groups.map((g) => ({ currency: g.group.currency, balances: new Map([[userId, g.myBalance]]) })),
  );
  const foreign = [...byCurrency.entries()].filter(([c, s]) => c !== preferred && (s.owed > 0 || s.owe > 0));

  if (rates && foreign.length > 0) {
    const own = byCurrency.get(preferred) ?? { owed: 0, owe: 0, net: 0 };
    let owed = own.owed;
    let owe = own.owe;
    for (const [c, s] of foreign) {
      owed += convertMinor(s.owed, c, preferred, rates);
      owe += convertMinor(s.owe, c, preferred, rates);
    }
    return {
      currency: preferred,
      summary: { owed, owe, net: owed - owe },
      others: [],
      converted: { currencies: foreign.map(([c]) => c), updatedAt: rates.updatedAt },
    };
  }

  const currency = byCurrency.has(preferred) || byCurrency.size === 0 ? preferred : [...byCurrency.keys()][0];
  return {
    currency,
    summary: byCurrency.get(currency) ?? { owed: 0, owe: 0, net: 0 },
    others: [...byCurrency.entries()]
      .filter(([c, s]) => c !== currency && (s.owed > 0 || s.owe > 0))
      .map(([c, summary]) => ({ currency: c, summary })),
  };
}

/** Whether Home needs exchange rates: some balance is in another currency. */
export function needsConversion(groups: GroupSummary[], preferred: CurrencyCode): boolean {
  return groups.some((g) => g.group.currency !== preferred && g.myBalance !== 0);
}
