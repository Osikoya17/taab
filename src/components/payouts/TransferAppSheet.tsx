import { Image } from 'expo-image';
import { ChevronRight, Landmark } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import type { RankedBankApp } from '@/features/payouts/bank-apps';

const TAG_COPY = { yours: 'Your bank', theirs: 'Same bank as them' } as const;

/** Like Android's "Open with": banking apps to pay from, with the account number already copied. */
export function TransferAppSheet({
  visible,
  onClose,
  apps,
  payeeName,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  apps: RankedBankApp[];
  payeeName: string;
  onPick: (app: RankedBankApp) => void;
}) {
  const colors = useColors();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Transfer with…"
      description={`Account number copied. Paste it in your bank app to pay ${payeeName}, then come back and record the payment.`}>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false}>
        {apps.map((app) => (
          <PressableScale
            key={app.target}
            onPress={() => onPick(app)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${app.name}${app.tag ? `, ${TAG_COPY[app.tag]}` : ''}`}
            className="flex-row items-center gap-3 rounded-2xl px-2 py-2.5">
            {app.icon ? (
              <Image source={{ uri: app.icon }} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-sunken">
                <Landmark size={18} color={colors.muted} strokeWidth={1.8} />
              </View>
            )}
            <View className="flex-1">
              <Text variant="bodyStrong">{app.name}</Text>
              {app.tag || app.via === 'store' ? (
                <Text variant="caption" tone="muted">
                  {[app.tag ? TAG_COPY[app.tag] : null, app.via === 'store' ? 'Opens the App Store, then tap Open' : null].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={18} color={colors.faint} />
          </PressableScale>
        ))}
      </ScrollView>
      <Text variant="caption" tone="faint" className="mt-3 text-center">
        Bank not here? Open it yourself and paste the number.
      </Text>
    </BottomSheet>
  );
}
