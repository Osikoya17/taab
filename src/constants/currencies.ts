import type { CurrencyCode } from '@/types/models';

export type CurrencyInfo = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** Number of minor units per major unit, as a power of ten (NGN: 2 → 100 kobo). */
  exponent: number;
  /** Symbol placement follows common local usage. */
  symbolPosition: 'prefix';
};

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', exponent: 2, symbolPosition: 'prefix' },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', exponent: 2, symbolPosition: 'prefix' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', exponent: 2, symbolPosition: 'prefix' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', exponent: 2, symbolPosition: 'prefix' },
};

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['NGN', 'USD', 'GBP', 'EUR'];

export const DEFAULT_CURRENCY: CurrencyCode =
  (process.env.EXPO_PUBLIC_DEFAULT_CURRENCY as CurrencyCode | undefined) &&
  SUPPORTED_CURRENCIES.includes(process.env.EXPO_PUBLIC_DEFAULT_CURRENCY as CurrencyCode)
    ? (process.env.EXPO_PUBLIC_DEFAULT_CURRENCY as CurrencyCode)
    : 'NGN';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as string[]).includes(value);
}
