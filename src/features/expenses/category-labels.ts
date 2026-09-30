import type { ExpenseCategory } from '@/types/models';

/** Category names without their icons, for plain-text copy such as edit history. */
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: 'Food & drink',
  transport: 'Transport',
  home: 'Home',
  utilities: 'Utilities',
  groceries: 'Groceries',
  entertainment: 'Going out',
  travel: 'Travel',
  subscriptions: 'Subscriptions',
  other: 'Other',
};
