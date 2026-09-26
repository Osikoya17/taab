import { Banknote, CircleEllipsis, Landmark, Smartphone, type LucideIcon } from 'lucide-react-native';

import type { SettlementMethod } from '@/types/models';

/**
 * Ways to settle. Today payments happen outside taab and are recorded here.
 * `in_app` is reserved for native payments; flip `available` once a payments
 * provider is wired into settlements.service.
 */
export const SETTLEMENT_METHODS: { value: SettlementMethod; label: string; icon: LucideIcon; available: boolean }[] = [
  { value: 'bank_transfer', label: 'Bank transfer', icon: Landmark, available: true },
  { value: 'cash', label: 'Cash', icon: Banknote, available: true },
  { value: 'other', label: 'Other', icon: CircleEllipsis, available: true },
  { value: 'in_app', label: 'Pay in taab', icon: Smartphone, available: false },
];

export const AVAILABLE_METHODS = SETTLEMENT_METHODS.filter((m) => m.available);
