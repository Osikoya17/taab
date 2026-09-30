import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ImageIcon, ScanLine, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { SheetHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { SCAN_COST } from '@/features/billing/products';
import { pickReceiptPhotos } from '@/features/expenses/receipt-photo';
import { useGroups } from '@/features/groups/queries';
import { useBalances, useCatalog, useGroupPack, useStartScan } from '@/features/packs/queries';
import { DEMO_RECEIPT_PHOTOS } from '@/features/scans/demo-photos';
import { useGoBack } from '@/hooks/use-go-back';
import { haptics } from '@/lib/haptics';
import { isServiceError } from '@/services/api/errors';
import { toast } from '@/store/toast.store';

function creditsLabel(n: number) {
  return `${n} ${n === 1 ? 'scan' : 'scans'}`;
}

/**
 * One receipt: photo → choose whose scans pay → scan → review. Nothing is
 * saved as an expense here; the review screen hands a draft to the form.
 */
export default function ScanScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const colors = useColors();
  const catalog = useCatalog();
  const balances = useBalances();
  const groups = useGroups();
  const pack = useGroupPack(groupId);
  const scan = useStartScan();
  const [photo, setPhoto] = useState<string | null>(null);
  // One key per photo: retrying the same photo can never charge twice.
  const [key, setKey] = useState(() => Crypto.randomUUID());
  const [payer, setPayer] = useState<'personal' | 'group' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const groupName = groups.data?.find((g) => g.group.id === groupId)?.group.name;
  const personal = balances.data?.personal.available ?? 0;
  const shared = pack.data?.owned ? pack.data.credits.available : 0;
  // Default to the taab's shared scans when it has some; they're meant for this.
  const chosen = payer ?? (shared > 0 ? 'group' : 'personal');
  const available = chosen === 'group' ? shared : personal;
  const scanning = catalog.data?.scanning ?? 'off';

  async function choose(source: 'camera' | 'library') {
    try {
      const result = await pickReceiptPhotos(source);
      if (result.status === 'no_camera_access') {
        toast.error('Camera access is off', 'Allow camera access in Settings, or choose a photo instead.');
        return;
      }
      if (result.status === 'cancelled') return;
      if (!result.photos[0]) {
        toast.error('That photo is too large', 'Try a different photo of the receipt.');
        return;
      }
      setPhoto(result.photos[0]);
      setKey(Crypto.randomUUID());
      setFailed(null);
    } catch {
      toast.error('Couldn’t open that photo', 'Try again.');
    }
  }

  async function run() {
    if (!photo) return;
    setFailed(null);
    try {
      const result = await scan.mutateAsync({ key, image: photo, account: chosen, groupId });
      if (result.status === 'drafted') {
        haptics.success();
        router.replace({ pathname: '/scan/[id]', params: { id: result.id } });
      } else if (result.status === 'failed') {
        haptics.warning();
        setFailed(result.error === 'unreadable'
          ? 'That doesn’t look like a receipt we can read. Try a clearer, flatter photo. Your scan wasn’t used.'
          : 'The scan didn’t finish. Your scan wasn’t used. Try again.');
      }
    } catch (error) {
      const code = isServiceError(error) ? error.code : 'unknown';
      setFailed(code === 'insufficient_credits' ? 'No scans left in that balance.'
        : code === 'forbidden' ? 'Only members of a taab can use its shared scans.'
        : code === 'unavailable' ? 'Receipt scanning isn’t available right now.'
        : 'Couldn’t reach taab. Check your connection and try again. Your scan wasn’t used.');
    }
  }

  return (
    <Screen
      safeTop={false}
      header={<SheetHeader title="Scan a receipt" onCancel={() => goBack(groupId ? `/group/${groupId}` : '/')} />}
      footer={
        photo && scanning !== 'off' ? (
          <View className="gap-2">
            <Text variant="caption" tone="muted" className="text-center">
              Uses {creditsLabel(SCAN_COST)} from {chosen === 'group' ? `${groupName ?? 'the taab'}’s pack` : 'your scans'} · {creditsLabel(Math.max(0, available - SCAN_COST))} left after
            </Text>
            <Button label="Scan receipt" icon={ScanLine} onPress={run} loading={scan.isPending} disabled={available < SCAN_COST} />
          </View>
        ) : undefined
      }>
      <Text variant="body" tone="muted" className="pt-2">
        taab reads the receipt and fills in a draft. You check it before anything is saved.
      </Text>

      {scanning === 'off' && catalog.isSuccess ? (
        <Surface className="mt-5">
          <Text variant="bodyStrong">Receipt scanning isn’t available yet</Text>
          <Text variant="caption" tone="muted" className="mt-1">
            You can still add the expense yourself and attach the receipt photo. That’s always free.
          </Text>
        </Surface>
      ) : null}

      {photo ? (
        <View className="mt-5 items-center">
          <Image source={{ uri: photo }} style={{ width: '100%', height: 260, borderRadius: 18, backgroundColor: colors.sunken }} contentFit="contain" accessibilityLabel="Receipt photo" />
          <Button label="Use a different photo" variant="ghost" size="md" fullWidth={false} onPress={() => setPhoto(null)} />
        </View>
      ) : scanning !== 'off' ? (
        <View className="mt-6 gap-2">
          <Button label="Take a photo" icon={Camera} onPress={() => choose('camera')} />
          <Button label="Choose a photo" icon={ImageIcon} variant="secondary" onPress={() => choose('library')} />
          {scanning === 'demo' ? (
            <Button
              label="Use a sample receipt (demo)"
              icon={Sparkles}
              variant="ghost"
              onPress={() => {
                setPhoto(DEMO_RECEIPT_PHOTOS[Math.floor(Math.random() * DEMO_RECEIPT_PHOTOS.length)]);
                setKey(Crypto.randomUUID());
              }}
            />
          ) : null}
        </View>
      ) : null}

      {photo && scanning !== 'off' ? (
        <View className="mt-6">
          <Text variant="label" tone="muted" className="mb-2">
            Pay with
          </Text>
          <View className="gap-2" accessibilityRole="radiogroup">
            <ChoiceRow label="Your scans" detail={`${creditsLabel(personal)} left`} selected={chosen === 'personal'} onPress={() => setPayer('personal')} />
            {pack.data?.owned ? (
              <ChoiceRow label={`${groupName ?? 'This taab'}’s trip pack`} detail={`${creditsLabel(shared)} left · shared with the taab`} selected={chosen === 'group'} onPress={() => setPayer('group')} />
            ) : null}
          </View>
          {available < SCAN_COST ? (
            <Surface className="mt-4 gap-3">
              <Text variant="body">You’re out of scans in this balance.</Text>
              <Button label="Get more scans" variant="secondary" size="md" onPress={() => router.push({ pathname: '/extras', params: groupId ? { groupId } : {} })} />
            </Surface>
          ) : null}
        </View>
      ) : null}

      {failed ? (
        <Text variant="caption" tone="negative" className="mt-4 text-center" accessibilityLiveRegion="polite">
          {failed}
        </Text>
      ) : null}
    </Screen>
  );
}
