import { buildOverview, needsConversion } from '@/features/groups/overview';
import type { GroupSummary } from '@/services/groups.service';
import type { CurrencyCode } from '@/types/models';

import { convertMinor, parseRates, type ExchangeRates } from './rates';

// Published by the provider on 28 Sep 2026.
const response = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: 1790553751,
  rates: { USD: 1, NGN: 1327.301923, GBP: 0.755594, EUR: 0.878356, JPY: 150.1 },
};
const rates: ExchangeRates = parseRates(response);

function group(currency: CurrencyCode, myBalance: number) {
  return { group: { currency }, myBalance } as GroupSummary;
}

describe('exchange rates', () => {
  it('keeps only supported currencies and the publish time', () => {
    expect(rates.perUsd).toEqual({ NGN: 1327.301923, USD: 1, GBP: 0.755594, EUR: 0.878356 });
    expect(rates.updatedAt).toBe(new Date(1790553751 * 1000).toISOString());
  });

  it('rejects failed or incomplete responses', () => {
    expect(() => parseRates({ ...response, result: 'error' })).toThrow();
    expect(() => parseRates({ ...response, rates: { USD: 1, GBP: 0.75, EUR: 0.87 } })).toThrow('NGN');
    expect(() => parseRates({ ...response, rates: { ...response.rates, NGN: 0 } })).toThrow('NGN');
    expect(() => parseRates(null)).toThrow();
  });

  it('converts minor units through the dollar and rounds to the nearest unit', () => {
    expect(convertMinor(1000, 'USD', 'NGN', rates)).toBe(1_327_302); // $10 → ₦13,273.02
    expect(convertMinor(10_000, 'GBP', 'EUR', rates)).toBe(11_625); // £100 → €116.25
    expect(convertMinor(500_000, 'NGN', 'USD', rates)).toBe(377); // ₦5,000 → $3.77
    expect(convertMinor(4_800_000, 'NGN', 'NGN', rates)).toBe(4_800_000);
  });
});

describe('home overview across currencies', () => {
  const groups = [group('NGN', 500_000), group('USD', -1000)];

  it('totals everything in the preferred currency at today’s rates', () => {
    const overview = buildOverview(groups, 'me', 'NGN', rates);
    expect(overview.summary).toEqual({ owed: 500_000, owe: 1_327_302, net: -827_302 });
    expect(overview.others).toEqual([]);
    expect(overview.converted).toEqual({ currencies: ['USD'], updatedAt: rates.updatedAt });
  });

  it('lists other currencies separately when rates are unavailable', () => {
    const overview = buildOverview(groups, 'me', 'NGN', null);
    expect(overview.summary).toEqual({ owed: 500_000, owe: 0, net: 500_000 });
    expect(overview.others).toEqual([{ currency: 'USD', summary: { owed: 0, owe: 1000, net: -1000 } }]);
    expect(overview.converted).toBeUndefined();
  });

  it('only asks for rates when a balance is in another currency', () => {
    expect(needsConversion(groups, 'NGN')).toBe(true);
    expect(needsConversion([group('NGN', 500_000), group('USD', 0)], 'NGN')).toBe(false);
  });
});
