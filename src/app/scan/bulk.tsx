import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, CircleX, ImageIcon, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { OPERATIONAL_LIMITS } from '@/features/billing/products';
import { pickReceiptPhotos } from '@/features/expenses/receipt-photo';
import { useGroup } from '@/features/groups/queries';
import { useCatalog, useGroupPack, useStartScan } from '@/features/packs/queries';
import { DEMO_RECEIPT_PHOTOS } from '@/features/scans/demo-photos';
import { isServiceError } from '@/services/api/errors';
import { toast } from '@/store/toast.store';
import { formatMoney } from '@/utils/money';

type Item = {
  /** Kept for retries, so a finished scan is never charged again. */
  key: string;
  photo: string;
  state: 'waiting' | 'scanning' | 'done' | 'failed';
  scanId?: string;
  summary?: string;
  problem?: string;
};

const PARALLEL = 2;

/** Trip & event pack: many receipts at once, each with its own progress and retry. */
export default function BulkScanScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const colors = useColors();
  const group = useGroup(groupId);
  const pack = useGroupPack(groupId);
  const catalog = useCatalog();
  const scan = useStartScan();
  const [batchId] = useState(() => Crypto.randomUUID());
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  function add(photos: string[]) {
    const room = OPERATIONAL_LIMITS.bulkScanBatch - items.length;
    if (photos.length > room) toast.show(`Up to ${OPERATIONAL_LIMITS.bulkScanBatch} receipts at a time`, `Added the first ${Math.max(0, room)}.`);
    setItems((list) => [...list, ...photos.slice(0, Math.max(0, room)).map((photo) => ({ key: Crypto.randomUUID(), photo, state: 'waiting' as const }))]);
  }

  async function choose() {
    try {
      const result = await pickReceiptPhotos('library', { multiple: true, limit: OPERATIONAL_LIMITS.bulkScanBatch });
      if (result.status !== 'picked') return;
      if (result.tooLarge) toast.show(`${result.tooLarge} photo${result.tooLarge === 1 ? ' was' : 's were'} too large to add`);
      add(result.photos);
    } catch {
      toast.error('Couldn’t open your photos', 'Try again.');
    }
  }

  async function runOne(item: Item) {
    update(item.key, { state: 'scanning', problem: undefined });
    try {
      const result = await scan.mutateAsync({ key: item.key, image: item.photo, account: 'group', groupId, batchId });
      if (result.status === 'drafted' && result.draft) {
        const d = result.draft;
        const total = d.total !== undefined ? formatMoney(d.total, d.currency ?? group.data?.group.currency ?? 'NGN') : 'no total found';
        update(item.key, { state: 'done', scanId: result.id, summary: `${d.merchant ?? 'Receipt'} · ${total}${d.warnings.length ? ' · check it' : ''}` });
      } else {
        update(item.key, { state: 'failed', problem: result.error === 'unreadable' ? 'Couldn’t read it. Not charged.' : 'Didn’t finish. Not charged.' });
      }
    } catch (error) {
      const code = isServiceError(error) ? error.code : 'unknown';
      update(item.key, {
        state: 'failed',
        problem: code === 'insufficient_credits' ? 'No shared scans left.' : code === 'limit_reached' ? 'Too many in this batch.' : 'Couldn’t reach taab. Not charged.',
      });
    }
  }

  /** Runs everything not yet done. Finished receipts are skipped, so retries never charge twice. */
  async function runAll() {
    const queue = items.filter((i) => i.state === 'waiting' || i.state === 'failed');
    if (!queue.length) return;
    setRunning(true);
    await Promise.all(Array.from({ length: PARALLEL }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await runOne(next);
    }));
    setRunning(false);
  }

  const owned = pack.data?.owned;
  const left = pack.data?.credits.available ?? 0;
  const done = items.filter((i) => i.state === 'done').length;
  const failed = items.filter((i) => i.state === 'failed').length;
  const waiting = items.filter((i) => i.state === 'waiting').length;

  if (pack.isSuccess && !owned) {
    return (
      <Screen header={<AppHeader back title="Scan receipts" />}>
        <EmptyState
          illustration="receipt"
          title="Bulk scanning comes with the trip pack"
          description="Get the trip & event pack for this taab to scan many receipts at once."
          actionLabel="See the trip pack"
          onAction={() => router.replace({ pathname: '/extras', params: { groupId } })}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<AppHeader back title="Scan receipts" />}
      footer={
        items.length ? (
          <View className="gap-2">
            <Text variant="caption" tone="muted" className="text-center">
              Uses {group.data?.group.name ?? 'the taab'}’s shared scans · {left} left · each receipt uses 1
            </Text>
            <Button
              label={waiting + failed === 0 ? 'All scanned' : failed && !waiting ? `Retry ${failed} failed` : `Scan ${waiting + failed} receipt${waiting + failed === 1 ? '' : 's'}`}
              icon={failed && !waiting ? RotateCcw : undefined}
              onPress={runAll}
              loading={running}
              disabled={running || waiting + failed === 0}
            />
          </View>
        ) : undefined
      }>
      <Text variant="body" tone="muted" className="pt-2">
        Add the receipts from {group.data?.group.name ?? 'this taab'}. Each one becomes a draft to check before it’s saved.
      </Text>

      <View className="mt-5 gap-2">
        <Button label={items.length ? 'Add more photos' : 'Choose photos'} icon={ImageIcon} variant={items.length ? 'secondary' : 'primary'} onPress={choose} disabled={running} />
        {catalog.data?.scanning === 'demo' ? (
          <Button label="Add sample receipts (demo)" icon={Sparkles} variant="ghost" onPress={() => add(DEMO_RECEIPT_PHOTOS)} disabled={running} />
        ) : null}
      </View>

      {items.length ? (
        <>
          <Text variant="label" tone="muted" className="mb-2 mt-6">
            {done} of {items.length} ready{failed ? ` · ${failed} failed` : ''}
          </Text>
          <Surface padded={false} className="px-4">
            {items.map((item, index) => {
              const Icon = item.state === 'done' ? CircleCheck : item.state === 'failed' ? CircleX : LoaderCircle;
              const row = (
                <View className="flex-row items-center gap-3 py-3">
                  <Image source={{ uri: item.photo }} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.sunken }} contentFit="cover" />
                  <View className="flex-1">
                    <Text variant="bodyStrong" numberOfLines={1}>
                      Receipt {index + 1}
                    </Text>
                    <Text variant="caption" tone={item.state === 'failed' ? 'negative' : 'muted'} numberOfLines={1}>
                      {item.state === 'waiting' ? 'Ready to scan' : item.state === 'scanning' ? 'Scanning…' : item.state === 'done' ? item.summary : item.problem}
                    </Text>
                  </View>
                  <Icon size={18} color={item.state === 'done' ? colors.positive : item.state === 'failed' ? colors.negative : colors.muted} strokeWidth={2} />
                </View>
              );
              return (
                <View key={item.key}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  {item.state === 'done' && item.scanId ? (
                    <PressableScale onPress={() => router.push({ pathname: '/scan/[id]', params: { id: item.scanId! } })} accessibilityLabel={`Review receipt ${index + 1}`} pressedScale={0.99}>
                      {row}
                    </PressableScale>
                  ) : row}
                </View>
              );
            })}
          </Surface>
          {done ? (
            <Text variant="caption" tone="faint" className="mt-2">
              Tap a finished receipt to review it and add it as an expense.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
