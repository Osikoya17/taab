import { NO_ALLOWANCES, type ScanAllowances } from '@/features/billing/products';
import type { ScanDraft } from '@/features/billing/types';
import type { CurrencyCode, MinorUnits } from '@/types/models';

/** What a payment provider reports after the server asks it about a payment. */
export type VerifiedPayment = {
  status: 'success' | 'pending' | 'failed' | 'abandoned' | 'reversed';
  amount: MinorUnits;
  currency: string;
};

/** A real payment provider. Only the server has one; its secrets never reach the app. */
export type PaymentProvider = {
  name: 'paystack';
  createCheckout(input: { reference: string; amount: MinorUnits; currency: CurrencyCode; email: string }): Promise<{ checkoutUrl: string }>;
  verify(reference: string): Promise<VerifiedPayment>;
};

/** What a scanner read, before taab adds its own warnings. */
export type ScannerResult = Omit<ScanDraft, 'warnings'> & {
  confidence: { total: 'high' | 'low'; date: 'high' | 'low' };
};

export class ScanFailure extends Error {
  constructor(readonly reason: 'unreadable' | 'scanner_error') {
    super(reason);
    this.name = 'ScanFailure';
  }
}

export type ReceiptScanner = {
  name: 'demo' | 'claude';
  extract(image: { dataUri: string }, hint: { currency: CurrencyCode }): Promise<ScannerResult>;
};

export type CheckoutMode = { mode: 'off' } | { mode: 'demo' } | { mode: 'provider'; provider: PaymentProvider };

export type PackRuntime = {
  allowances: ScanAllowances;
  checkout: CheckoutMode;
  scanner: ReceiptScanner | null;
  /** Stores a receipt photo and returns the URL to save with the scan. */
  storeReceipt: (dataUri: string) => string;
};

/**
 * Safe by default: nothing can be bought or scanned until the server (or the
 * on-device demo) configures it. A misconfigured server never charges anyone.
 */
let runtime: PackRuntime = {
  allowances: NO_ALLOWANCES,
  checkout: { mode: 'off' },
  scanner: null,
  storeReceipt: (dataUri) => dataUri,
};

export function configurePacks(next: Partial<PackRuntime>) {
  runtime = { ...runtime, ...next };
}

export function packRuntime(): PackRuntime {
  return runtime;
}
