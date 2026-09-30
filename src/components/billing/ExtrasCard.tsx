import { ChevronRight, ScanLine } from 'lucide-react-native';
import { View } from 'react-native';

import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useBalances } from '@/features/packs/queries';

/** Profile's way into optional packs. Quiet on purpose: the app itself is free. */
export function ExtrasCard({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const balances = useBalances();
  const scans = balances.data?.personal.available ?? 0;
  return (
    <Surface onPress={onPress} accessibilityLabel={`Extras, ${scans} receipt scans left`} className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
        <ScanLine size={20} color={colors.ink} strokeWidth={1.8} />
      </View>
      <View className="flex-1">
        <Text variant="bodyStrong">Extras</Text>
        <Text variant="caption" tone="muted">
          Receipt scans and trip packs · one-off, nothing renews
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        {scans} {scans === 1 ? 'scan' : 'scans'}
      </Text>
      <ChevronRight size={18} color={colors.faint} />
    </Surface>
  );
}
