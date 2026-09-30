import { DEMO_RECEIPT_PHOTOS } from '@/features/scans/demo-photos';

import type { ReceiptScanner, ScannerResult } from './runtime';

/**
 * Development only: returns sample receipts instead of reading the photo, so
 * the whole flow can be tried without an AI provider. Drafts are marked
 * `source: 'demo'` and the app labels them as sample data.
 */
const SAMPLES: Omit<ScannerResult, 'currency'>[] = [
  {
    merchant: 'Mama Put Kitchen',
    items: [{ description: 'Jollof rice ×3', amount: 600_000 }, { description: 'Grilled fish', amount: 450_000 }, { description: 'Zobo ×3', amount: 150_000 }],
    charges: [{ label: 'Service charge', amount: 60_000 }],
    total: 1_290_000,
    confidence: { total: 'high', date: 'high' },
    source: 'demo',
  },
  {
    merchant: 'Shoprite Lekki',
    items: [{ description: 'Groceries', amount: 2_350_000 }],
    charges: [],
    total: 2_350_000,
    confidence: { total: 'high', date: 'low' },
    source: 'demo',
  },
  {
    merchant: 'Total Energies Ajah',
    items: [{ description: 'Petrol 25L', amount: 1_750_000 }],
    charges: [],
    total: 1_800_000,
    confidence: { total: 'low', date: 'high' },
    source: 'demo',
  },
];

export const demoScanner: ReceiptScanner = {
  name: 'demo',
  async extract(image, hint) {
    // The same photo always gives the same sample, so retries are predictable.
    let hash = 2166136261;
    const step = Math.max(1, Math.floor(image.dataUri.length / 4000));
    for (let i = 0; i < image.dataUri.length; i += step) hash = Math.imul(hash ^ image.dataUri.charCodeAt(i), 16777619) >>> 0;
    // The built-in demo photos each map to their own sample.
    const known = DEMO_RECEIPT_PHOTOS.indexOf(image.dataUri);
    const sample = SAMPLES[known >= 0 ? known % SAMPLES.length : hash % SAMPLES.length];
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...sample, currency: hint.currency, date: new Date().toISOString().slice(0, 10) };
  },
};
