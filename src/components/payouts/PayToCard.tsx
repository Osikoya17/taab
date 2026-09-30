import * as Clipboard from 'expo-clipboard';
import { Copy, Landmark } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { formatAccountNumber } from '@/features/payouts/banks';
import { haptics } from '@/lib/haptics';
import type { MemberPayout } from '@/services/payouts.service';
import { toast } from '@/store/toast.store';

/**
 * "Pay into GTBank · 0123 456 789 · Tolu Adeyemi" with a copy button, so the
 * payer can transfer from their own banking app. taab never moves the money.
 */
export function PayToCard({ account, name, compact = false }: { account?: MemberPayout; name: string; compact?: boolean }) {
  const colors = useColors();

  async function copy() {
    if (!account) return;
    try {
      await Clipboard.setStringAsync(account.accountNumber);
      haptics.selection();
      toast.show('Account number copied', `${account.bankName} · ${account.accountName}`);
    } catch {
      toast.error('Couldn’t copy', 'Select the number and copy it yourself.');
    }
  }

  if (!account) {
    return compact ? null : (
      <View className="rounded-2xl bg-sunken px-4 py-3">
        <Text variant="caption" tone="muted">
          {name} hasn’t added bank details yet. Ask them where to send it.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-sunken px-4 py-3" accessible accessibilityLabel={`Pay into ${account.bankName}, account ${account.accountNumber.split('').join(' ')}, ${account.accountName}`}>
      <Landmark size={18} color={colors.muted} strokeWidth={1.8} />
      <View className="flex-1">
        <Text variant="caption" tone="muted">
          Pay into {account.bankName}
        </Text>
        <Text variant="bodyStrong" selectable style={{ fontVariant: ['tabular-nums'] }}>
          {formatAccountNumber(account.accountNumber)}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {account.accountName}
        </Text>
      </View>
      <IconButton icon={Copy} variant="plain" accessibilityLabel="Copy account number" onPress={copy} />
    </View>
  );
}
