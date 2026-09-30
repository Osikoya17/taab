import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProductId } from '@/features/billing/products';
import { invalidateLedger } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import { packsService } from '@/services/packs.service';
import { reportsService } from '@/services/reports.service';
import { scansService, type ScanInput } from '@/services/scans.service';

export function useCatalog() {
  return useQuery({ queryKey: queryKeys.packCatalog, queryFn: () => packsService.getCatalog(), staleTime: 5 * 60 * 1000 });
}

export function useBalances() {
  return useQuery({ queryKey: queryKeys.packBalances, queryFn: () => packsService.getBalances() });
}

export function useGroupPack(groupId: string | undefined) {
  return useQuery({ queryKey: queryKeys.groupPack(groupId ?? ''), queryFn: () => packsService.getGroupPack(groupId!), enabled: !!groupId });
}

export function usePurchases() {
  return useQuery({ queryKey: queryKeys.purchases, queryFn: () => packsService.listPurchases() });
}

/** Anything that changes what someone owns refreshes every pack view. */
function useRefreshPacks() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['packs'] });
}

export function useStartPurchase() {
  const refresh = useRefreshPacks();
  return useMutation({
    mutationFn: (input: { productId: ProductId; groupId?: string }) => packsService.startPurchase(input),
    onSettled: refresh,
  });
}

export function useConfirmPurchase() {
  const refresh = useRefreshPacks();
  return useMutation({ mutationFn: (purchaseId: string) => packsService.confirmPurchase(purchaseId), onSettled: refresh });
}

export function useCompleteDemoPurchase() {
  const refresh = useRefreshPacks();
  return useMutation({
    mutationFn: ({ purchaseId, outcome }: { purchaseId: string; outcome: 'success' | 'cancelled' }) => packsService.completeDemoPurchase(purchaseId, outcome),
    onSettled: refresh,
  });
}

export function useScan(scanId: string | undefined) {
  return useQuery({ queryKey: queryKeys.scan(scanId ?? ''), queryFn: () => scansService.getScan(scanId!), enabled: !!scanId });
}

export function useStartScan() {
  const refresh = useRefreshPacks();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ScanInput) => scansService.startScan(input),
    onSuccess: (scan) => client.setQueryData(queryKeys.scan(scan.id), scan),
    onSettled: refresh,
  });
}

export function useGroupReport() {
  return useMutation({ mutationFn: (groupId: string) => reportsService.getGroupReport(groupId) });
}

/** After saving an expense from a scan, balances and the scan's link both change. */
export function refreshAfterScanSave() {
  return invalidateLedger();
}
