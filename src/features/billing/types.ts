import type { CurrencyCode, ISODateString, MinorUnits } from '@/types/models';

import type { ProductId } from './products';

/**
 * A retired taab+ subscription record. Kept read-only for history: nothing
 * checks it any more, because every taab+ feature is now free.
 */
export type LegacySubscription = {
  plan: string;
  status: string;
  currentPeriodEnd?: ISODateString;
  trialEndsAt?: ISODateString;
  source?: string;
  updatedAt: ISODateString;
};

/**
 * - `pending`: checkout started, payment not verified yet.
 * - `paid`: verified by the server with the payment provider; credits granted.
 * - `cancelled` / `failed` / `expired`: nothing granted.
 * - `refunded`: was paid; unused credits removed.
 */
export type PurchaseStatus = 'pending' | 'paid' | 'cancelled' | 'failed' | 'expired' | 'refunded';

export type PaymentProviderName = 'demo' | 'paystack';

export type Purchase = {
  id: string;
  userId: string;
  productId: ProductId;
  /** Set for group packs. */
  groupId?: string;
  amount: MinorUnits;
  currency: CurrencyCode;
  /** Scans this purchase grants, fixed when checkout starts. */
  credits: number;
  provider: PaymentProviderName;
  /** The provider's reference for the payment. */
  reference: string;
  status: PurchaseStatus;
  checkoutUrl?: string;
  /** Demo purchases only: what the tester chose on the demo checkout. */
  demoOutcome?: 'success' | 'cancelled';
  /** Why a paid purchase needs a person to look at it, e.g. a second pack for the same taab. */
  flag?: 'duplicate_group_pack' | 'amount_mismatch';
  createdAt: ISODateString;
  updatedAt: ISODateString;
  paidAt?: ISODateString;
  refundedAt?: ISODateString;
};

/** Personal credits are keyed `user:<id>`; a taab's shared credits `group:<id>`. */
export type CreditAccountKey = `user:${string}` | `group:${string}`;

export type CreditAccount = {
  /** Ready to spend. */
  available: number;
  /** Held by scans in progress; consumed on success, returned on failure. */
  reserved: number;
};

export type CreditEntry = {
  id: string;
  account: CreditAccountKey;
  delta: number;
  reason: 'purchase' | 'scan' | 'refund';
  purchaseId?: string;
  scanId?: string;
  createdAt: ISODateString;
};

export type GroupPack = {
  groupId: string;
  purchaseId: string;
  buyerId: string;
  ownedAt: ISODateString;
};

export type ScanWarning = 'no_total' | 'total_unclear' | 'items_dont_match_total' | 'date_unclear' | 'currency_unclear';

/** What the scanner read. Everything is a suggestion for a person to check. */
export type ScanDraft = {
  merchant?: string;
  /** YYYY-MM-DD */
  date?: string;
  currency?: CurrencyCode;
  total?: MinorUnits;
  items: { description: string; amount: MinorUnits }[];
  /** Tax, service charge, delivery and similar. */
  charges: { label: string; amount: MinorUnits }[];
  warnings: ScanWarning[];
  /** Which scanner produced it. `demo` drafts are sample data. */
  source: 'demo' | 'claude';
};

export type ScanStatus = 'reserved' | 'drafted' | 'failed';

export type ScanJob = {
  id: string;
  userId: string;
  /** The idempotency key the app sends, so a retry never charges twice. */
  key: string;
  account: CreditAccountKey;
  /** The taab whose pack paid, for shared credits. */
  groupId?: string;
  batchId?: string;
  status: ScanStatus;
  /** Where the photo is stored (a data URI on the device demo). */
  receiptUrl: string;
  draft?: ScanDraft;
  error?: 'unreadable' | 'scanner_error' | 'interrupted';
  /** The expense created from this draft, once someone saves one. */
  expenseId?: string;
  attempts: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};
