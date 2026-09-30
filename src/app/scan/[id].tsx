import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useWindowDimensions, View } from 'react-native';

import { ScanNotice } from '@/components/scans/ScanNotice';
import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useReceiptImage } from '@/features/expenses/use-receipt-image';
import { useScan } from '@/features/packs/queries';
import { formatMoney } from '@/utils/money';
import { shortDate } from '@/utils/dates';

function Field({ label, value, flagged }: { label: string; value: string; flagged?: boolean }) {
  const colors = useColors();
  return (
    <View className="flex-row items-center justify-between gap-3 py-2.5">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <View className="flex-shrink flex-row items-center gap-1.5">
        {flagged ? <TriangleAlert size={14} color={colors.negative} strokeWidth={2} /> : null}
        <Text variant="bodyStrong" className="text-right" tone={flagged ? 'negative' : 'ink'}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/**
 * The photo beside what was read from it. Nothing is saved here: "Use these
 * details" opens the normal expense form, where the person checks and saves.
 */
export default function ScanReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const scan = useScan(id);
  const photo = useReceiptImage(scan.data?.receiptUrl);
  const wide = width >= 720;

  if (scan.isError) {
    return (
      <Screen header={<AppHeader back title="Review scan" />}>
        <ErrorState title="Couldn’t load this scan." onRetry={() => scan.refetch()} />
      </Screen>
    );
  }
  const job = scan.data;
  if (!job) {
    return (
      <Screen header={<AppHeader back title="Review scan" />}>
        <LoadingSkeleton rows={4} />
      </Screen>
    );
  }
  const draft = job.draft;
  const currency = draft?.currency ?? 'NGN';
  const money = (amount: number) => formatMoney(amount, currency);
  const warn = new Set(draft?.warnings ?? []);

  return (
    <Screen
      header={<AppHeader back title="Review scan" />}
      footer={
        draft ? (
          <View className="gap-2">
            <Button label="Use these details" onPress={() => router.replace({ pathname: '/expense/new', params: { scanId: job.id, ...(job.groupId ? { groupId: job.groupId } : {}) } })} />
            <Text variant="caption" tone="faint" className="text-center">
              You’ll choose who paid and who shares it next. Nothing is saved until you do.
            </Text>
          </View>
        ) : undefined
      }>
      {!draft ? (
        <Surface className="mt-2">
          <Text variant="bodyStrong">This scan didn’t produce a draft</Text>
          <Text variant="caption" tone="muted" className="mt-1">
            {job.error === 'interrupted' ? 'It was cut off before it finished.' : 'The photo couldn’t be read.'} Your scan wasn’t used.
          </Text>
          <Button label="Scan again" size="md" className="mt-3" onPress={() => router.replace({ pathname: '/scan', params: job.groupId ? { groupId: job.groupId } : {} })} />
        </Surface>
      ) : (
        <View className={wide ? 'mt-2 flex-row gap-5' : 'mt-2 gap-5'}>
          <View style={wide ? { flex: 1 } : undefined}>
            <Image
              source={photo ? { uri: photo } : undefined}
              style={{ width: '100%', height: wide ? 520 : 300, borderRadius: 18, backgroundColor: colors.sunken }}
              contentFit="contain"
              accessibilityLabel="The receipt photo you scanned"
            />
          </View>
          <View style={wide ? { flex: 1 } : undefined} className="gap-4">
            <ScanNotice draft={draft} />
            <Surface padded={false} className="px-4">
              <Field label="Where" value={draft.merchant ?? 'Not found'} flagged={!draft.merchant} />
              <Divider />
              <Field label="Total" value={draft.total !== undefined ? money(draft.total) : 'Not found'} flagged={warn.has('no_total') || warn.has('total_unclear') || warn.has('items_dont_match_total')} />
              <Divider />
              <Field label="Date" value={draft.date ? shortDate(`${draft.date}T12:00:00`) : 'Today'} flagged={warn.has('date_unclear')} />
              <Divider />
              <Field label="Currency" value={draft.currency ?? 'The taab’s own'} flagged={warn.has('currency_unclear')} />
            </Surface>
            {draft.items.length || draft.charges.length ? (
              <Surface padded={false} className="px-4 py-1">
                <Text variant="label" tone="muted" className="pt-3">
                  On the receipt
                </Text>
                {[...draft.items.map((i) => ({ label: i.description, amount: i.amount })), ...draft.charges].map((line, index) => (
                  <View key={`${line.label}-${index}`} className="flex-row justify-between gap-3 py-2">
                    <Text variant="body" className="flex-1">
                      {line.label}
                    </Text>
                    <Text variant="body">{money(line.amount)}</Text>
                  </View>
                ))}
              </Surface>
            ) : null}
          </View>
        </View>
      )}
    </Screen>
  );
}
