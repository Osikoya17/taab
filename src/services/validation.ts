import { z } from 'zod';

export const idSchema = z.string().min(1).max(200);
export const currencySchema = z.enum(['NGN', 'USD', 'GBP', 'EUR']);
export const moneySchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const useCaseSchema = z.enum(['friends', 'roommates', 'trips', 'couples', 'family', 'work', 'other']);
const memberAmount = z.object({ userId: idSchema, amount: moneySchema });
export const expenseInputSchema = z.object({
  groupId: idSchema,
  title: z.string().trim().min(1).max(80),
  amount: moneySchema.positive(),
  paidBy: z.array(memberAmount).min(1).max(100),
  splitBetween: z.array(memberAmount.extend({ value: moneySchema.optional() })).min(1).max(100),
  splitMethod: z.enum(['equal', 'exact', 'percentage', 'shares']),
  date: z.iso.datetime(),
  category: z.enum(['food', 'transport', 'home', 'utilities', 'entertainment', 'groceries', 'travel', 'subscriptions', 'other']).optional(),
  notes: z.string().max(500).optional(),
  receiptUrl: z.string().max(1_400_100).optional(),
  /** What was typed when entered in another currency. Informational: `amount` is authoritative. */
  original: z.object({ amount: moneySchema.positive(), currency: currencySchema, rate: z.number().positive().finite().max(1_000_000) }).optional(),
  /** The receipt scan a person checked before saving. */
  scanId: idSchema.optional(),
});
export const recurringInputSchema = expenseInputSchema.pick({ groupId: true, title: true, amount: true, paidBy: true, splitBetween: true, splitMethod: true }).extend({
  frequency: z.enum(['weekly', 'monthly', 'custom']),
  intervalDays: z.number().int().min(1).max(3650).optional(),
  nextDate: z.iso.datetime(),
  autoCreate: z.boolean(),
  anchorDay: z.number().int().min(1).max(31).optional(),
}).refine((r) => r.frequency !== 'custom' || r.intervalDays !== undefined);
export const repeatSchema = z.object({ frequency: z.enum(['weekly', 'monthly']), autoCreate: z.boolean() });
export const inviteSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), userId: idSchema }),
  z.object({ kind: z.literal('email'), email: z.email().max(254).transform((s) => s.toLowerCase()), name: z.string().trim().min(1).max(80).optional() }),
  z.object({ kind: z.literal('phone'), phone: z.string().regex(/^\+?[\d ()-]{7,24}$/), name: z.string().trim().min(1).max(80) }),
]);
export const groupInputSchema = z.object({
  name: z.string().trim().min(1).max(80), description: z.string().trim().max(500).optional(),
  type: z.enum(['home', 'trip', 'friends', 'couple', 'event', 'work', 'other']), currency: currencySchema,
  invites: z.array(inviteSchema).max(99),
});
export const profilePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(), avatarUrl: z.string().max(2048).optional(),
  defaultCurrency: currencySchema.optional(), useCase: useCaseSchema.optional(),
});
export const setupSchema = z.object({ name: z.string().trim().min(1).max(80), useCase: useCaseSchema, currency: currencySchema, includeSampleTaabs: z.boolean() });
/** A bank account for being paid back. Numbers are digits only (a Nigerian NUBAN is 10). */
export const payoutAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(60),
  accountNumber: z.string().regex(/^\d{6,20}$/),
  accountName: z.string().trim().min(2).max(80),
}).strict();

export const settlementSchema = z.object({
  groupId: idSchema, fromUserId: idSchema, toUserId: idSchema, amount: moneySchema.positive(),
  method: z.enum(['bank_transfer', 'cash', 'other']), note: z.string().trim().max(500).optional(),
});
