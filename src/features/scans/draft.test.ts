import { parseAllowance } from '@/features/billing/products';
import type { ScannerResult } from '@/services/packs/runtime';

import { DEMO_RECEIPT_PHOTOS } from './demo-photos';
import { analyzeDraft, isAcceptedImage } from './draft';

const base: ScannerResult = {
  merchant: 'Kitchen',
  date: '2026-09-01',
  currency: 'NGN',
  total: 12_900_00,
  items: [{ description: 'Rice', amount: 12_000_00 }],
  charges: [{ label: 'Service', amount: 900_00 }],
  confidence: { total: 'high', date: 'high' },
  source: 'demo',
};

describe('analyzeDraft', () => {
  it('trusts nothing silently but flags nothing on a clean receipt', () => {
    expect(analyzeDraft(base)).toEqual([]);
  });

  it('flags totals that don’t match the lines, allowing a kobo of rounding', () => {
    expect(analyzeDraft({ ...base, total: base.total! + 1 })).toEqual([]);
    expect(analyzeDraft({ ...base, total: base.total! + 5_000 })).toEqual(['items_dont_match_total']);
  });

  it('flags a missing or unclear total, date and currency', () => {
    expect(analyzeDraft({ ...base, total: undefined })).toEqual(['no_total']);
    expect(analyzeDraft({ ...base, confidence: { total: 'low', date: 'low' } })).toEqual(['total_unclear', 'date_unclear']);
    expect(analyzeDraft({ ...base, date: undefined, currency: undefined })).toEqual(['date_unclear', 'currency_unclear']);
  });
});

describe('isAcceptedImage', () => {
  it('accepts real PNGs and rejects mislabelled or oversized data', () => {
    expect(DEMO_RECEIPT_PHOTOS.every(isAcceptedImage)).toBe(true);
    expect(isAcceptedImage(DEMO_RECEIPT_PHOTOS[0].replace('image/png', 'image/jpeg'))).toBe(false);
    expect(isAcceptedImage('data:image/png;base64,bm90IGFuIGltYWdl')).toBe(false);
    expect(isAcceptedImage('data:image/gif;base64,R0lGODlh')).toBe(false);
    expect(isAcceptedImage(`data:image/png;base64,${'A'.repeat(1_400_004)}`)).toBe(false);
  });
});

describe('parseAllowance', () => {
  it('accepts whole numbers from 1 to 1,000 and nothing else', () => {
    expect(parseAllowance('25')).toBe(25);
    expect(parseAllowance(' 1000 ')).toBe(1000);
    for (const bad of [undefined, '', '0', '-5', '2.5', '1001', 'unlimited', '1e3']) expect(parseAllowance(bad)).toBeNull();
  });
});
