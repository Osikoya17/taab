import type { ScanDraft, ScanWarning } from '@/features/billing/types';
import type { ScannerResult } from '@/services/packs/runtime';

/** The largest photo accepted, as base64 characters. Matches the receipt-attachment limit. */
export const MAX_SCAN_BASE64 = 1_400_000;

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes the first bytes of base64 without Buffer, so the check runs on phones too. */
function firstBytes(b64: string, count: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i + 3 < b64.length && bytes.length < count; i += 4) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => BASE64.indexOf(b64[i + k]));
    if (a < 0 || b < 0) break;
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0) bytes.push(((c & 3) << 6) | d);
  }
  return bytes.slice(0, count);
}

/**
 * Accepts only JPEG, PNG or WebP photos within the size limit, checked by
 * their actual bytes, not just the label.
 */
export function isAcceptedImage(dataUri: string): boolean {
  const match = dataUri.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length > MAX_SCAN_BASE64) return false;
  const b = firstBytes(match[2], 12);
  if (match[1] === 'jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (match[1] === 'png') return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v);
  const text = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  return text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP';
}

/** Flags anything a person should check before trusting the draft. */
export function analyzeDraft(result: ScannerResult): ScanWarning[] {
  const warnings: ScanWarning[] = [];
  if (result.total === undefined) warnings.push('no_total');
  else if (result.confidence.total === 'low') warnings.push('total_unclear');
  if (result.total !== undefined && result.items.length > 0) {
    const counted = [...result.items, ...result.charges].reduce((sum, line) => sum + line.amount, 0);
    // A kobo either way is rounding on the receipt, not a mismatch.
    if (Math.abs(counted - result.total) > 1) warnings.push('items_dont_match_total');
  }
  if (!result.date || result.confidence.date === 'low') warnings.push('date_unclear');
  if (!result.currency) warnings.push('currency_unclear');
  return warnings;
}

export function toDraft(result: ScannerResult): ScanDraft {
  const { confidence: _confidence, ...rest } = result;
  return { ...rest, warnings: analyzeDraft(result) };
}

export const WARNING_COPY: Record<ScanWarning, string> = {
  no_total: 'No total found. Type the amount from the receipt.',
  total_unclear: 'The total was hard to read. Check it against the photo.',
  items_dont_match_total: 'The items don’t add up to the total. Check which is right.',
  date_unclear: 'The date was unclear, so today is used. Change it if needed.',
  currency_unclear: 'The currency wasn’t clear. The taab’s currency is used.',
};
