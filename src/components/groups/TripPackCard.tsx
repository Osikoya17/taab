import { useRouter } from 'expo-router';
import { FileDown, Luggage, ScanLine } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { PRODUCTS } from '@/features/billing/products';
import { useGroupPack } from '@/features/packs/queries';
import { useDownloadGroupReport } from '@/features/reports/use-download-report';
import { formatMoney } from '@/utils/money';

/** A taab's trip & event pack: what it adds, or the tools once someone buys it. */
export function TripPackCard({ groupId }: { groupId: string }) {
  const colors = useColors();
  const router = useRouter();
  const pack = useGroupPack(groupId);
  const report = useDownloadGroupReport();
  if (!pack.data) return null;
  const { owned, credits, someoneElseBuying } = pack.data;
  const price = PRODUCTS.trip_pack.price;

  return (
    <Surface className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
          <Luggage size={18} color={colors.ink} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <Text variant="bodyStrong">Trip & event pack</Text>
          <Text variant="caption" tone="muted">
            {owned
              ? `${credits.available} shared ${credits.available === 1 ? 'scan' : 'scans'} left for everyone here`
              : someoneElseBuying
                ? 'Someone in this taab is buying it now'
                : `${formatMoney(price.amount, price.currency)} once, for everyone in this taab`}
          </Text>
        </View>
      </View>
      {owned ? (
        <View className="flex-row gap-2">
          <Button label="Scan receipts" icon={ScanLine} size="md" variant="secondary" className="flex-1" onPress={() => router.push({ pathname: '/scan/bulk', params: { groupId } })} />
          <Button label="Report" icon={FileDown} size="md" variant="secondary" className="flex-1" loading={report.pending} onPress={() => report.download(groupId)} />
        </View>
      ) : !someoneElseBuying ? (
        <>
          <Text variant="caption" tone="muted">
            Shared receipt scans, scanning in bulk, and a report of who paid what, for everyone in the taab.
          </Text>
          <Button label="See the trip pack" size="md" variant="secondary" onPress={() => router.push({ pathname: '/extras', params: { groupId } })} />
        </>
      ) : null}
    </Surface>
  );
}
