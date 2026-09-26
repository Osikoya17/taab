import { CURRENCIES } from '@/constants/currencies';
import type { CurrencyCode, MinorUnits } from '@/types/models';

/** U+2212 MINUS SIGN reads better than a hyphen next to currency symbols. */
export const MINUS = '−';

export type FormatMoneyOptions = {
  /**
   * `auto` shows the fraction only when it is non-zero (₦12,500 but ₦12,500.50).
   * `always` pads to the currency exponent, `never` rounds half away from zero.
   */
  fraction?: 'auto' | 'always' | 'never';
  /** `always` prefixes a + for positive values; negatives always get a minus. */
  sign?: 'auto' | 'always' | 'never';
};

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Number of minor units per major unit, e.g. 100 for NGN. */
export function minorFactor(currency: CurrencyCode): number {
  return 10 ** CURRENCIES[currency].exponent;
}

/**
 * Formats an integer minor-unit amount. Pure string maths — no floats and no
 * Intl dependency — so output is identical on Hermes, JSC, web and Node.
 *
 * formatMoney(1250000, 'NGN') → '₦12,500'
 */
export function formatMoney(
  amount: MinorUnits,
  currency: CurrencyCode,
  { fraction = 'auto', sign = 'auto' }: FormatMoneyOptions = {},
): string {
  const info = CURRENCIES[currency];
  const factor = minorFactor(currency);
  const negative = amount < 0;
  let abs = Math.abs(Math.trunc(amount));

  if (fraction === 'never') {
    abs = Math.round(abs / factor) * factor;
  }

  const major = Math.floor(abs / factor);
  const minor = abs % factor;

  let body = groupThousands(String(major));
  const showFraction = info.exponent > 0 && (fraction === 'always' || (fraction === 'auto' && minor !== 0));
  if (showFraction) {
    body += '.' + String(minor).padStart(info.exponent, '0');
  }

  const isZero = abs === 0;
  let prefix = '';
  if (sign !== 'never' && !isZero) {
    if (negative) prefix = MINUS;
    else if (sign === 'always') prefix = '+';
  }

  return `${prefix}${info.symbol}${body}`;
}

/**
 * Parses user-typed text ("12,500.5", "12500") into minor units without
 * floating-point maths. Returns null for anything that is not a valid amount.
 */
export function parseMoneyInput(text: string, currency: CurrencyCode): MinorUnits | null {
  const exponent = CURRENCIES[currency].exponent;
  const trimmed = text.trim();
  const symbol = CURRENCIES[currency].symbol;
  const cleaned = (trimmed.startsWith(symbol) ? trimmed.slice(symbol.length).trim() : trimmed);
  if (cleaned === '' || cleaned === '.') return null;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d*)?$/.test(cleaned)) return null;

  const [wholePart = '0', fractionPart = ''] = cleaned.replace(/,/g, '').split('.');
  if (fractionPart.length > exponent) return null;

  const value = BigInt(wholePart || '0') * BigInt(10 ** exponent)
    + BigInt((fractionPart + '0'.repeat(exponent)).slice(0, exponent) || '0');
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

/** Converts a whole major-unit number into minor units, e.g. toMinor(48000, 'NGN') → 4800000. */
export function toMinor(major: number, currency: CurrencyCode): MinorUnits {
  return Math.round(major * minorFactor(currency));
}

/** Formats minor units as a plain editable string ("12500.5") for text inputs. */
export function toInputString(amount: MinorUnits, currency: CurrencyCode): string {
  const factor = minorFactor(currency);
  const major = Math.floor(Math.abs(amount) / factor);
  const minor = Math.abs(amount) % factor;
  if (minor === 0) return String(major);
  return `${major}.${String(minor).padStart(CURRENCIES[currency].exponent, '0').replace(/0+$/, '')}`;
}
