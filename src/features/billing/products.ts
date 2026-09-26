import type { CurrencyCode, MinorUnits } from '@/types/models';

/** Product identifiers. Keep in sync with the plans configured in Clerk Billing. */
export const FREE = 'free';
export const PLUS_MONTHLY = 'plus_monthly';
export const PLUS_YEARLY = 'plus_yearly';

export type PlanId = typeof FREE | typeof PLUS_MONTHLY | typeof PLUS_YEARLY;
export type PaidPlanId = typeof PLUS_MONTHLY | typeof PLUS_YEARLY;

/**
 * Clerk models one plan with monthly and annual prices, so both paid product
 * ids map to the same Clerk plan slug used in `has({ plan })` checks.
 */
export const CLERK_PLUS_PLAN_SLUG = 'plus';

/** Feature keys. Mirror these as Clerk Billing features for `has({ feature })`. */
export const FEATURES = {
  unlimitedGroups: 'unlimited_groups',
  advancedSplits: 'advanced_splits',
  recurringExpenses: 'recurring_expenses',
  exportHistory: 'export_history',
  extendedHistory: 'extended_history',
  receiptScanning: 'receipt_scanning',
  customCovers: 'custom_group_covers',
  advancedInsights: 'advanced_insights',
  premiumThemes: 'premium_themes',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/** Generous free tier — the core product must stay fully usable. */
export const FREE_LIMITS = {
  activeGroups: 5,
  /** Activity older than this is hidden on the free plan (never deleted). */
  historyMonths: 12,
} as const;

export type PlanPrice = {
  id: PaidPlanId;
  label: string;
  interval: 'month' | 'year';
  currency: CurrencyCode;
  amount: MinorUnits;
  trialDays?: number;
};

export const PLUS_PRICES: Record<PaidPlanId, PlanPrice> = {
  [PLUS_MONTHLY]: { id: PLUS_MONTHLY, label: 'Monthly', interval: 'month', currency: 'NGN', amount: 150_000 },
  [PLUS_YEARLY]: { id: PLUS_YEARLY, label: 'Yearly', interval: 'year', currency: 'NGN', amount: 1_500_000, trialDays: 7 },
};

/** Percentage saved by paying yearly versus twelve monthly payments (0 when not cheaper). */
export function yearlySavingsPercent(): number {
  const monthlyForYear = PLUS_PRICES[PLUS_MONTHLY].amount * 12;
  const yearly = PLUS_PRICES[PLUS_YEARLY].amount;
  if (yearly >= monthlyForYear) return 0;
  return Math.round(((monthlyForYear - yearly) / monthlyForYear) * 100);
}

export const PLUS_BENEFITS: { feature: FeatureKey; title: string; detail: string; available: boolean }[] = [
  { feature: FEATURES.unlimitedGroups, title: 'Unlimited taabs', detail: `Free includes ${FREE_LIMITS.activeGroups} active taabs.`, available: true },
  { feature: FEATURES.advancedSplits, title: 'Percentages and shares', detail: 'Split by % or by shares, not just equally.', available: true },
  { feature: FEATURES.recurringExpenses, title: 'Recurring expenses', detail: 'Rent, Netflix and bills that add themselves.', available: true },
  { feature: FEATURES.exportHistory, title: 'Export history', detail: 'Share a clean summary of any taab.', available: true },
  { feature: FEATURES.extendedHistory, title: 'Full history', detail: `Free keeps the last ${FREE_LIMITS.historyMonths} months in view.`, available: true },
  { feature: FEATURES.receiptScanning, title: 'Receipt scanning', detail: 'Snap a receipt and taab fills it in.', available: false },
  { feature: FEATURES.customCovers, title: 'Custom group covers', detail: 'Give each taab its own look.', available: false },
];
