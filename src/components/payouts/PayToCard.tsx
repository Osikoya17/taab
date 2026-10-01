import * as Clipboard from 'expo-clipboard';
import { Copy, Landmark, Send } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { TransferAppSheet } from '@/components/payouts/TransferAppSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { rankBankApps, type RankedBankApp } from '@/features/payouts/bank-apps';
import { formatAccountNumber } from '@/features/payouts/banks';
import { findBankApps, openBankApp } from '@/features/payouts/installed-apps';
import { useMyPayouts } from '@/features/payouts/queries';
import { haptics } from '@/lib/haptics';
import type { MemberPayout } from '@/services/payouts.service';
import { toast } from '@/store/toast.store';

/**
 * "Pay into GTBank · 0123 456 789 · Tolu Adeyemi" with copy and "Transfer now",
 * so the payer can transfer from their own banking app. taab never moves the money.
 */
export function PayToCard({ account, name, compact = false }: { account?: MemberPayout; name: string; compact?: boolean }) {
  const colors = useColors();
  const mine = useMyPayouts();
  const [apps, setApps] = useState<RankedBankApp[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [finding, setFinding] = useState(false);

  async function copyNumber(): Promise<boolean> {
    if (!account) return false;
    try {
      await Clipboard.setStringAsync(account.accountNumber);
      haptics.selection();
      return true;
    } catch {
      toast.error('Couldn’t copy', 'Select the number and copy it yourself.');
      return false;
    }
  }

  async function copy() {
    if (account && (await copyNumber())) toast.show('Account number copied', `${account.bankName} · ${account.accountName}`);
  }

  /** Copy the number, then offer the banking apps on this phone, like "Open with". */
  async function transfer() {
    if (!account || !(await copyNumber())) return;
    setFinding(true);
    const installed = await findBankApps();
    setFinding(false);
    if (installed.length === 0) {
      toast.show('Account number copied', `Open your bank app and paste it to pay ${name}.`);
      return;
    }
    setApps(rankBankApps(installed, { payer: mine.data?.default?.bankName, payee: account.bankName }));
    setChoosing(true);
  }

  async function pick(app: RankedBankApp) {
    setChoosing(false);
    if (!(await openBankApp(app.target))) toast.error(`Couldn’t open ${app.name}`, 'Open it yourself and paste the number.');
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
    <View className="gap-3 rounded-2xl bg-sunken px-4 py-3">
      <View className="flex-row items-center gap-3" accessible accessibilityLabel={`Pay into ${account.bankName}, account ${account.accountNumber.split('').join(' ')}, ${account.accountName}`}>
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
      <Button
        label="Transfer now"
        icon={Send}
        size="md"
        variant="secondary"
        loading={finding}
        onPress={transfer}
        accessibilityHint={`Copies the account number and opens your bank app to pay ${name}`}
      />
      <TransferAppSheet visible={choosing} onClose={() => setChoosing(false)} apps={apps} payeeName={name} onPick={pick} />
    </View>
  );
}
