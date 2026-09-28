import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';

import { fetchExchangeRates } from './rates';

/**
 * Today's exchange rates, fetched only when there is something to convert.
 * The provider publishes once a day, so a few hours of freshness is plenty.
 */
export function useExchangeRates(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.exchangeRates,
    queryFn: ({ signal }) => fetchExchangeRates(signal),
    enabled,
    staleTime: 6 * 60 * 60 * 1000,
    networkMode: 'online',
    retry: 1,
  });
}
