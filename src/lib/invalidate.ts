import { ledgerKeys } from './query-keys';
import { queryClient } from './query-client';

/** Refreshes everything derived from balances after money moves. */
export function invalidateLedger() {
  return Promise.all(ledgerKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
}
