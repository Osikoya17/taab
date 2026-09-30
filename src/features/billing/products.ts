import type { CurrencyCode, MinorUnits } from '@/types/models';

/**
 * One-off packs. Everyday expense sharing is free; packs add optional tools
 * that save time. Nothing renews, and credits never expire.
 *
 * Prices are provisional and live only here. Scan allowances are not decided:
 * the server reads them from RECEIPT_PACK_SCANS and TRIP_PACK_SCANS, and a pack
 * can't be bought until its allowance is set (see README → Packs).
 */
export type ProductId = 'receipt_scan_pack' | 'trip_pack';

export type Product = {
  id: ProductId;
  /** Personal credits belong to the buyer; a group pack belongs to the taab. */
  kind: 'personal' | 'group';
  name: string;
  /** Per what the price is charged. */
  unit: string;
  price: { amount: MinorUnits; currency: CurrencyCode };
  bulkScanning: boolean;
  report: boolean;
};

export const PRODUCTS: Record<ProductId, Product> = {
  receipt_scan_pack: {
    id: 'receipt_scan_pack',
    kind: 'personal',
    name: 'Receipt-scanning pack',
    unit: 'per pack',
    price: { amount: 100_000, currency: 'NGN' },
    bulkScanning: false,
    report: false,
  },
  trip_pack: {
    id: 'trip_pack',
    kind: 'group',
    name: 'Trip & event pack',
    unit: 'per taab',
    price: { amount: 200_000, currency: 'NGN' },
    bulkScanning: true,
    report: true,
  },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

/** Scans each pack adds. `null` means not configured yet: the pack can't be bought. */
export type ScanAllowances = Record<ProductId, number | null>;

export const NO_ALLOWANCES: ScanAllowances = { receipt_scan_pack: null, trip_pack: null };

/** Used only by the on-device demo and development servers, and labelled as demo in the app. */
export const DEMO_ALLOWANCES: ScanAllowances = { receipt_scan_pack: 10, trip_pack: 40 };

/** A configured allowance must be a whole number of scans between 1 and 1,000. */
export function parseAllowance(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n >= 1 && n <= 1000 ? n : null;
}

/** Credits one scan uses. */
export const SCAN_COST = 1;

/**
 * Operational limits that stay on the free app. They stop abuse and keep the
 * single-process server healthy; they are not a paywall.
 */
export const OPERATIONAL_LIMITS = {
  activeGroups: 100,
  /** Receipts in one bulk upload. */
  bulkScanBatch: 20,
} as const;
