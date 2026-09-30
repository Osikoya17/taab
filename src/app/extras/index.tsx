import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Luggage, ScanLine } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Divider } from '@/components/ui/Divider';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import type { ProductId } from '@/features/billing/products';
import type { PurchaseStatus } from '@/features/billing/types';
import { useGroups } from '@/features/groups/queries';
import { useBalances, useCatalog, useCompleteDemoPurchase, useConfirmPurchase, usePurchases, useStartPurchase } from '@/features/packs/queries';
import { haptics } from '@/lib/haptics';
import { isServiceError } from '@/services/api/errors';
import type { CatalogItem, PurchaseView } from '@/services/packs.service';
import { toast } from '@/store/toast.store';
import { shortDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

const STATUS_COPY: Record<PurchaseStatus, string> = {
  pending: 'Waiting for payment confirmation',
  paid: 'Paid',
  cancelled: 'Cancelled, not charged',
  failed: 'Didn’t go through',
  expired: 'Not completed',
  refunded: 'Refunded',
};

function includes(item: CatalogItem): string[] {
  const scans = item.credits ? `${item.credits} receipt scans` : 'Receipt scans (number to be confirmed)';
  return item.kind === 'personal'
    ? [`${scans} for you to use in any taab`, 'Scans don’t expire and never renew', 'Manual entry and receipt photos stay free']
    : [`${scans} shared by everyone in the taab`, 'Scan many receipts at once', 'A downloadable trip or event report', 'One purchase covers the whole taab'];
}

function ProductCard({ item, children }: { item: CatalogItem; children: React.ReactNode }) {
  const colors = useColors();
  const Icon = item.kind === 'personal' ? ScanLine : Luggage;
  return (
    <Surface className="gap-4">
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
          <Icon size={20} color={colors.ink} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <Text variant="subheading">{item.name}</Text>
          <Text variant="body" tone="muted">
            {formatMoney(item.price.amount, item.price.currency)} {item.unit} · one-off
          </Text>
        </View>
      </View>
      <View className="gap-2">
        {includes(item).map((line) => (
          <View key={line} className="flex-row items-start gap-2">
            <Check size={16} color={colors.positive} strokeWidth={2.2} style={{ marginTop: 2 }} />
            <Text variant="body" className="flex-1">
              {line}
            </Text>
          </View>
        ))}
      </View>
      {children}
    </Surface>
  );
}

/**
 * Optional packs. Everyday splitting is free; nothing here renews. Credits
 * are granted only after the server verifies the payment.
 */
export default function ExtrasScreen() {
  const params = useLocalSearchParams<{ groupId?: string; purchase?: string }>();
  const router = useRouter();
  const catalog = useCatalog();
  const balances = useBalances();
  const purchases = usePurchases();
  const groups = useGroups();
  const start = useStartPurchase();
  const confirm = useConfirmPurchase();
  const completeDemo = useCompleteDemoPurchase();
  const [tripGroupId, setTripGroupId] = useState<string | undefined>(params.groupId);
  const [demo, setDemo] = useState<PurchaseView | null>(null);
  const [returned, setReturned] = useState<PurchaseView | null>(null);
  const checkedReturn = useRef(false);

  // Back from a hosted checkout: ask the server to verify with the provider.
  useEffect(() => {
    if (!params.purchase || checkedReturn.current) return;
    checkedReturn.current = true;
    confirm.mutate(params.purchase, { onSuccess: setReturned, onError: () => toast.error('Couldn’t check that payment', 'Pull to refresh in a moment.') });
  }, [params.purchase, confirm]);

  const ownedGroupIds = new Set(balances.data?.groups.map((g) => g.groupId));
  const buyable = (groups.data ?? []).filter((g) => !ownedGroupIds.has(g.group.id));
  // A taab that already owns the pack can't be chosen, even if the link pointed at it.
  const selectedTrip = buyable.find((g) => g.group.id === tripGroupId);
  const checkout = catalog.data?.checkout ?? 'off';
  // App stores require their own billing for digital extras, so web checkout isn't offered inside the phone apps.
  const webCheckoutHere = checkout === 'web' && Platform.OS === 'web';
  const canCheckout = checkout === 'demo' || webCheckoutHere;

  async function buy(productId: ProductId, groupId?: string) {
    try {
      const result = await start.mutateAsync({ productId, groupId });
      if (result.demo) setDemo(result.purchase);
      else if (result.checkoutUrl && Platform.OS === 'web') window.location.assign(result.checkoutUrl);
    } catch (error) {
      const code = isServiceError(error) ? error.code : 'unknown';
      toast.error(
        code === 'already_owned' ? 'This taab already has the pack, or someone in it is buying it now' : 'Couldn’t start checkout',
        code === 'already_owned' ? undefined : 'Nothing was charged. Try again in a moment.',
      );
    }
  }

  async function finishDemo(outcome: 'success' | 'cancelled') {
    if (!demo) return;
    try {
      const result = await completeDemo.mutateAsync({ purchaseId: demo.id, outcome });
      setDemo(null);
      if (result.status === 'paid') {
        haptics.success();
        toast.success('Demo pack added', `${result.credits} demo scans. No money moved.`);
      } else toast.show('Demo purchase cancelled');
    } catch {
      toast.error('Couldn’t finish the demo purchase');
    }
  }

  function buyButton(item: CatalogItem, groupId?: string, label?: string) {
    const disabledReason = item.reason === 'allowance_not_set' ? 'Coming soon' : !canCheckout ? 'Not available in the app yet' : undefined;
    return (
      <View className="gap-1.5">
        <Button
          label={disabledReason ?? label ?? `Buy for ${formatMoney(item.price.amount, item.price.currency)}`}
          onPress={() => buy(item.id, groupId)}
          loading={start.isPending && start.variables?.productId === item.id}
          disabled={!!disabledReason || (item.kind === 'group' && !groupId)}
        />
        {checkout === 'web' && Platform.OS !== 'web' && item.reason !== 'allowance_not_set' ? (
          <Text variant="caption" tone="faint" className="text-center">
            Buying packs isn’t available in the app yet. Packs you already have work everywhere.
          </Text>
        ) : null}
      </View>
    );
  }

  const personalProduct = catalog.data?.products.find((p) => p.id === 'receipt_scan_pack');
  const tripProduct = catalog.data?.products.find((p) => p.id === 'trip_pack');

  return (
    <Screen header={<AppHeader back title="Extras" />}>
      <Text variant="body" tone="muted" className="pt-2">
        Splitting, balances, reminders and history are free. These optional packs save time. They’re one-off purchases: nothing renews.
      </Text>

      {checkout === 'demo' ? (
        <View className="mt-4 rounded-2xl bg-accent-soft px-4 py-3">
          <Text variant="label">Demo mode</Text>
          <Text variant="caption" className="mt-0.5">
            Purchases here are simulated. No money moves and no card is needed.
          </Text>
        </View>
      ) : null}

      {returned ? (
        <Surface className="mt-4">
          <Text variant="bodyStrong">{returned.status === 'paid' ? 'Pack added' : STATUS_COPY[returned.status]}</Text>
          <Text variant="caption" tone="muted" className="mt-1">
            {returned.status === 'paid'
              ? `${returned.credits} scans are ready to use.`
              : returned.status === 'pending'
                ? 'Your bank hasn’t confirmed it yet. It will appear here as soon as it does.'
                : 'Nothing was added and you weren’t charged for a pack.'}
          </Text>
          {returned.status === 'pending' ? (
            <Button label="Check again" size="md" variant="secondary" className="mt-3" loading={confirm.isPending} onPress={() => confirm.mutate(returned.id, { onSuccess: setReturned })} />
          ) : null}
        </Surface>
      ) : null}

      <Surface className="mt-5">
        <Text variant="label" tone="muted">
          Your scans
        </Text>
        <Text variant="heading" className="mt-1">
          {balances.data?.personal.available ?? 0} left
        </Text>
        {balances.data?.groups.length ? (
          <View className="mt-3 gap-1">
            {balances.data.groups.map((g) => (
              <Text key={g.groupId} variant="caption" tone="muted">
                {g.groupName} trip pack · {g.credits.available} shared scans left
              </Text>
            ))}
          </View>
        ) : null}
      </Surface>

      {catalog.isError ? (
        <ErrorState title="Couldn’t load the packs." onRetry={() => catalog.refetch()} />
      ) : !catalog.data ? (
        <View className="mt-5 gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <View className="mt-5 gap-4">
          {personalProduct ? <ProductCard item={personalProduct}>{buyButton(personalProduct)}</ProductCard> : null}
          {tripProduct ? (
            <ProductCard item={tripProduct}>
              {buyable.length ? (
                <>
                  <Text variant="label" tone="muted">
                    Which taab?
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                    {buyable.map((g) => (
                      <Chip key={g.group.id} label={g.group.name} selected={tripGroupId === g.group.id} onPress={() => setTripGroupId(g.group.id)} />
                    ))}
                  </ScrollView>
                  {buyButton(tripProduct, selectedTrip?.group.id, selectedTrip ? `Get it for ${selectedTrip.group.name}` : 'Choose a taab first')}
                </>
              ) : (
                <Text variant="caption" tone="muted">
                  {groups.data?.length ? 'All your taabs already have the pack.' : 'Create a taab first, then add the pack to it.'}
                </Text>
              )}
            </ProductCard>
          ) : null}
        </View>
      )}

      {purchases.data?.length ? (
        <>
          <Text variant="label" tone="muted" className="mb-2 mt-7">
            Your purchases
          </Text>
          <Surface padded={false} className="px-4">
            {purchases.data.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Divider /> : null}
                <View className="flex-row items-center justify-between gap-3 py-3">
                  <View className="flex-1">
                    <Text variant="bodyStrong">
                      {p.productId === 'trip_pack' ? 'Trip & event pack' : 'Receipt-scanning pack'}
                      {p.demo ? ' (demo)' : ''}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {shortDate(p.createdAt)} · {STATUS_COPY[p.status]}
                    </Text>
                  </View>
                  <Text variant="body">{formatMoney(p.amount, p.currency)}</Text>
                </View>
              </View>
            ))}
          </Surface>
        </>
      ) : null}

      <Text variant="caption" tone="faint" className="mt-6 text-center">
        Packs pay for taab’s optional features. taab never holds or moves the money you pay back to friends.
      </Text>

      <BottomSheet
        visible={!!demo}
        onClose={() => finishDemo('cancelled')}
        title="Demo checkout"
        description={demo ? `${demo.productId === 'trip_pack' ? 'Trip & event pack' : 'Receipt-scanning pack'} · ${formatMoney(demo.amount, demo.currency)}. This is a simulation: no money moves and no card is charged.` : undefined}>
        <View className="gap-2">
          <Button label="Complete demo purchase" onPress={() => finishDemo('success')} loading={completeDemo.isPending} />
          <Button label="Cancel" variant="ghost" onPress={() => finishDemo('cancelled')} disabled={completeDemo.isPending} />
        </View>
      </BottomSheet>

      {params.groupId && ownedGroupIds.has(params.groupId) ? (
        <Button label="Back to the taab" variant="ghost" className="mt-2" onPress={() => router.replace(`/group/${params.groupId}`)} />
      ) : null}
    </Screen>
  );
}
