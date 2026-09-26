import {
  Car,
  Clapperboard,
  House,
  Lightbulb,
  Luggage,
  Receipt,
  ShoppingBasket,
  Tv,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';

import type { ExpenseCategory } from '@/types/models';

export const CATEGORIES: { value: ExpenseCategory; label: string; icon: LucideIcon }[] = [
  { value: 'food', label: 'Food & drink', icon: UtensilsCrossed },
  { value: 'transport', label: 'Transport', icon: Car },
  { value: 'home', label: 'Home', icon: House },
  { value: 'utilities', label: 'Utilities', icon: Lightbulb },
  { value: 'groceries', label: 'Groceries', icon: ShoppingBasket },
  { value: 'entertainment', label: 'Going out', icon: Clapperboard },
  { value: 'travel', label: 'Travel', icon: Luggage },
  { value: 'subscriptions', label: 'Subscriptions', icon: Tv },
  { value: 'other', label: 'Other', icon: Receipt },
];

export function categoryMeta(category?: ExpenseCategory) {
  return CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** Light keyword matching so common titles get a sensible icon automatically. */
export function guessCategory(title: string): ExpenseCategory | undefined {
  const t = title.toLowerCase();
  if (/(dinner|lunch|breakfast|suya|food|restaurant|drinks|pizza|chicken|rice)/.test(t)) return 'food';
  if (/(uber|bolt|taxi|fuel|petrol|bus|train|flight|ride)/.test(t)) return 'transport';
  if (/(rent|cleaning|furniture)/.test(t)) return 'home';
  if (/(electric|nepa|light|water|internet|wifi|gas)/.test(t)) return 'utilities';
  if (/(grocer|market|shoprite|supermarket)/.test(t)) return 'groceries';
  if (/(netflix|spotify|showmax|gym|subscription|youtube)/.test(t)) return 'subscriptions';
  if (/(cinema|movie|party|club|concert|owambe)/.test(t)) return 'entertainment';
  if (/(hotel|airbnb|cabin|trip|beach)/.test(t)) return 'travel';
  return undefined;
}
