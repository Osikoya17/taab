import { CURRENCIES, SUPPORTED_CURRENCIES } from '@/constants/currencies';
import type { CurrencyCode, MinorUnits } from '@/types/models';

/**
 * Daily reference rates from ExchangeRate-API's free open-access endpoint (no
 * key, CORS enabled, published once a day). Their terms require the credit below.
 */
export const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
export const RATES_ATTRIBUTION = { label: 'Rates by Exchange Rate API', url: 'https://www.exchangerate-api.com' } as const;

export type ExchangeRates = {
  /** Units of each currency per 1 US dollar. */
  perUsd: Record<CurrencyCode, number>;
  /** When the provider last published these rates. */
  updatedAt: string;
};

/** Validates the provider's response and keeps only the currencies taab supports. */
export function parseRates(body: unknown): ExchangeRates {
  const data = (body ?? {}) as { result?: unknown; base_code?: unknown; rates?: Record<string, unknown>; time_last_update_unix?: unknown };
  if (data.result !== 'success' || data.base_code !== 'USD' || !data.rates || typeof data.time_last_update_unix !== 'number') {
    throw new Error('Unexpected exchange-rate response');
  }
  const perUsd = {} as Record<CurrencyCode, number>;
  for (const code of SUPPORTED_CURRENCIES) {
    const rate = data.rates[code];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) throw new Error(`Missing exchange rate for ${code}`);
    perUsd[code] = rate;
  }
  return { perUsd, updatedAt: new Date(data.time_last_update_unix * 1000).toISOString() };
}

/**
 * Converts an amount between currencies, rounded to the nearest minor unit.
 * For display only: what people owe each other stays in the group's currency.
 */
export function convertMinor(amount: MinorUnits, from: CurrencyCode, to: CurrencyCode, rates: ExchangeRates): MinorUnits {
  if (from === to) return amount;
  const major = amount / 10 ** CURRENCIES[from].exponent;
  const converted = (major / rates.perUsd[from]) * rates.perUsd[to];
  return Math.round(converted * 10 ** CURRENCIES[to].exponent);
}

export type DisplayAmount = { amount: MinorUnits; currency: CurrencyCode; converted: boolean };

/**
 * An amount as the viewer asked to see it. Falls back to the original
 * currency when no display currency is chosen or today's rates aren't known.
 */
export function toDisplay(amount: MinorUnits, from: CurrencyCode, display: CurrencyCode | null, rates: ExchangeRates | undefined): DisplayAmount {
  if (!display || display === from || !rates) return { amount, currency: from, converted: false };
  return { amount: convertMinor(amount, from, display, rates), currency: display, converted: true };
}

/** How many units of `to` one unit of `from` buys. */
export function rateBetween(from: CurrencyCode, to: CurrencyCode, rates: ExchangeRates): number {
  return rates.perUsd[to] / rates.perUsd[from];
}

function groupDigits(value: number): string {
  const [whole, fraction] = value.toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}

/**
 * "$1 = ₦1,327.30". Always quoted from the stronger currency so the number is
 * readable (never "₦1 = $0.00").
 */
export function formatRate(rate: number, from: CurrencyCode, to: CurrencyCode): string {
  const [one, other, value] = rate >= 1 ? [from, to, rate] : [to, from, 1 / rate];
  return `${CURRENCIES[one].symbol}1 = ${CURRENCIES[other].symbol}${groupDigits(value)}`;
}

export async function fetchExchangeRates(signal?: AbortSignal): Promise<ExchangeRates> {
  const response = await fetch(RATES_URL, { signal });
  if (!response.ok) throw new Error(`Exchange rates unavailable (${response.status})`);
  return parseRates(await response.json());
}
