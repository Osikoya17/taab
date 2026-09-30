import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { payoutsService } from '@/services/payouts.service';
import type { PayoutAccount } from '@/types/models';

export const payoutKeys = {
  mine: ['payouts', 'mine'] as const,
  group: (groupId: string) => ['payouts', 'group', groupId] as const,
};

export function useMyPayouts() {
  return useQuery({ queryKey: payoutKeys.mine, queryFn: () => payoutsService.getMine() });
}

/** Members' accounts in a taab, for paying them back. */
export function useGroupPayouts(groupId: string | undefined) {
  return useQuery({ queryKey: payoutKeys.group(groupId ?? ''), queryFn: () => payoutsService.getGroupAccounts(groupId!), enabled: !!groupId });
}

function useRefresh() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: ['payouts'] }), client.invalidateQueries({ queryKey: ['settle'] })]);
}

export function useSetDefaultPayout() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (account: PayoutAccount | null) => payoutsService.setDefault(account), onSuccess: refresh });
}

export function useSetGroupPayout() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ groupId, account }: { groupId: string; account: PayoutAccount | null }) => payoutsService.setForGroup(groupId, account),
    onSuccess: refresh,
  });
}
