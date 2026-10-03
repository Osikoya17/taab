/** Centralised query keys so invalidation stays consistent. */
export const queryKeys = {
  profile: ['profile'] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  groupExpenses: (id: string) => ['group', id, 'expenses'] as const,
  groupSettlements: (id: string) => ['group', id, 'settlements'] as const,
  expense: (id: string) => ['expense', id] as const,
  expenseHistory: (id: string) => ['expense', id, 'history'] as const,
  settle: (groupId?: string) => ['settle', groupId ?? 'all'] as const,
  pendingPayments: ['settle', 'pending'] as const,
  settleExplain: (groupId: string) => ['settle', 'explain', groupId] as const,
  activity: (groupId?: string) => ['activity', groupId ?? 'all'] as const,
  reminder: (groupId: string, userId: string) => ['reminder', groupId, userId] as const,
  recurring: (groupId: string) => ['recurring', groupId] as const,
  recurringDue: ['recurring', 'due'] as const,
  notifications: ['notifications'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,
  packCatalog: ['packs', 'catalog'] as const,
  packBalances: ['packs', 'balances'] as const,
  purchases: ['packs', 'purchases'] as const,
  groupPack: (groupId: string) => ['packs', 'group', groupId] as const,
  scan: (id: string) => ['packs', 'scan', id] as const,
  people: (query: string) => ['people', query] as const,
  exchangeRates: ['exchange-rates', 'USD'] as const,
};

/** Everything derived from the ledger — refresh after any money change. */
export const ledgerKeys = [['groups'], ['group'], ['expense'], ['settle'], ['activity'], ['reminder'], ['notifications']] as const;
