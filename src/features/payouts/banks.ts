import type { PayoutAccount } from '@/types/models';

/** Common Nigerian banks and wallets, offered as quick picks. Any other name can be typed. */
export const COMMON_BANKS = [
  'Access Bank', 'GTBank', 'Zenith Bank', 'First Bank', 'UBA', 'Kuda', 'OPay', 'Moniepoint', 'PalmPay',
  'Wema Bank', 'Fidelity Bank', 'Stanbic IBTC', 'Sterling Bank', 'FCMB', 'Union Bank', 'Ecobank',
];

/** Digits only: people paste numbers with spaces or dashes. */
export function cleanAccountNumber(value: string): string {
  return value.replace(/\D/g, '');
}

export type PayoutFormErrors = Partial<Record<keyof PayoutAccount, string>>;

/** Friendly checks before saving. The server checks the same rules. */
export function validatePayout(account: PayoutAccount): PayoutFormErrors {
  const errors: PayoutFormErrors = {};
  if (account.bankName.trim().length < 2) errors.bankName = 'Choose or type your bank';
  const digits = cleanAccountNumber(account.accountNumber);
  if (digits.length < 6 || digits.length > 20) errors.accountNumber = 'Enter your account number (10 digits for Nigerian banks)';
  if (account.accountName.trim().length < 2) errors.accountName = 'Enter the name on the account';
  return errors;
}

/** "0123 456 789" is easier to read aloud and check than a run of digits. */
export function formatAccountNumber(digits: string): string {
  return digits.length === 10 ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : digits;
}

/** After “Not now”, the Home card comes back after two weeks. */
const PROMPT_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export function shouldShowPayoutPrompt(hasAccount: boolean, dismissedAt: string | null, now = Date.now()) {
  return !hasAccount && (!dismissedAt || now - Date.parse(dismissedAt) >= PROMPT_SNOOZE_MS);
}
