import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SettledCheck } from '@/components/settlements/SettledCheck';
import { SheetHeader } from '@/components/ui/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormInput } from '@/components/ui/FormInput';
import { Money } from '@/components/ui/Money';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { BalanceSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useAuthSession } from '@/features/auth/auth-context';
import { useDisplayCurrency } from '@/features/currency/display';
import { convertMinor } from '@/features/currency/rates';
import { useGroup } from '@/features/groups/queries';
import { AVAILABLE_METHODS } from '@/features/settlements/methods';
import { useRecordSettlement } from '@/features/settlements/queries';
import { haptics } from '@/lib/haptics';
import { captureEvent } from '@/lib/posthog';
import { toast } from '@/store/toast.store';
import type { SettlementMethod } from '@/types/models';
import { formatMoney } from '@/utils/money';
import { useGoBack } from '@/hooks/use-go-back';

type Params = { groupId: string; fromUserId: string; toUserId: string; amount: string };

export default function RecordPaymentScreen() {
  const params = useLocalSearchParams<Params>();
  const goBack = useGoBack();
  const { user } = useAuthSession();
  const meId = user?.id ?? '';
  const group = useGroup(params.groupId);
  const record = useRecordSettlement();

  const suggested = Number(params.amount) || 0;
  const [mode, setMode] = useState<'full' | 'custom'>('full');
  const [custom, setCustom] = useState(0);
  const [method, setMethod] = useState<SettlementMethod>('bank_transfer');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ amount: number } | null>(null);
  const { display, rates, format } = useDisplayCurrency();

  const detail = group.data;
  if (!detail) {
    return (
      <Screen safeTop={false} header={<SheetHeader title="Record payment" onCancel={() => goBack(`/group/${params.groupId}`)} />}>
        {group.isError ? <ErrorState title="Couldn’t load this taab." onRetry={() => group.refetch()} /> : <BalanceSkeleton />}
      </Screen>
    );
  }

  const currency = detail.group.currency;
  /** A custom amount is typed in the display currency and saved in the taab's. */
  const entry = display && rates ? display : currency;
  const youPay = params.fromUserId === meId;
  const otherId = youPay ? params.toUserId : params.fromUserId;
  const other = detail.group.members.find((m) => m.userId === otherId);
  const otherName = other?.name ?? 'them';
  // "Full amount" records the exact debt, so it always settles to zero.
  const amount = mode === 'full' ? suggested : entry !== currency && rates ? convertMinor(custom, entry, currency, rates) : custom;
  const tooMuch = amount > suggested;

  async function submit() {
    if (amount <= 0) return;
    try {
      await record.mutateAsync({ groupId: params.groupId, fromUserId: params.fromUserId, toUserId: params.toUserId, amount, method, note });
      captureEvent('settlement_recorded', {
        currency,
        payment_method: method,
        amount_mode: mode,
        recorded_as_payer: youPay,
      });
      haptics.success();
      setDone({ amount });
    } catch {
      toast.error('Couldn’t record that payment', 'Check your connection and try again.');
    }
  }

  if (done) {
    const remaining = Math.max(0, suggested - done.amount);
    return (
      <Screen safeTop={false} scroll={false} footer={<Button label="Done" onPress={() => goBack(`/group/${params.groupId}`)} />}>
        <View className="flex-1 items-center justify-center px-8">
          <SettledCheck size={120} />
          <Animated.View entering={FadeIn.delay(350).duration(300)} style={{ alignItems: 'center' }}>
            <Text variant="title" className="mt-6 text-center">
              {remaining === 0 ? `You’re settled with ${otherName}.` : 'Payment recorded.'}
            </Text>
            <Text variant="body" tone="muted" className="mt-2 text-center">
              {remaining === 0
                ? `${format(done.amount, currency)} ${youPay ? 'paid to' : 'received from'} ${otherName}.`
                : `${format(remaining, currency)} still to go with ${otherName}.`}
            </Text>
          </Animated.View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      safeTop={false}
      header={<SheetHeader title="Record payment" onCancel={() => goBack(`/group/${params.groupId}`)} />}
      footer={
        <Button
          label={youPay ? 'Record payment' : 'Mark as paid'}
          onPress={submit}
          loading={record.isPending}
          disabled={amount <= 0}
          accessibilityHint={`Records ${format(amount, currency)}`}
        />
      }>
      <View className="items-center pt-4">
        <Avatar name={otherName} uri={other?.avatarUrl} seed={otherId} size={64} />
        <Text variant="body" tone="muted" className="mt-4">
          {youPay ? `You owe ${otherName}` : `${otherName} owes you`}
        </Text>
        <Money amount={suggested} currency={currency} size="large" />
        <Text variant="caption" tone="faint" className="mt-1">
          {detail.group.name}
        </Text>
      </View>

      <View className="mt-8">
        <SegmentedControl
          accessibilityLabel="Payment amount"
          value={mode}
          onChange={setMode}
          segments={[
            { value: 'full', label: 'Full amount' },
            { value: 'custom', label: 'Custom amount' },
          ]}
        />
        {mode === 'custom' ? (
          <View className="mt-4">
            <CurrencyInput value={custom} onChange={setCustom} currency={entry} autoFocus />
            {entry !== currency && custom > 0 ? (
              <Text variant="caption" tone="muted" className="text-center">
                Records {formatMoney(amount, currency)} in {detail.group.name}
              </Text>
            ) : null}
            {tooMuch ? (
              <Text variant="caption" tone="muted" className="text-center">
                That’s more than the {format(suggested, currency)} outstanding — the extra will show as credit.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="mt-7">
        <Text variant="label" tone="muted" className="mb-2">
          How was it paid?
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {AVAILABLE_METHODS.map((m) => (
            <Chip key={m.value} label={m.label} icon={m.icon} selected={method === m.value} onPress={() => setMethod(m.value)} />
          ))}
        </View>
        <Text variant="caption" tone="faint" className="mt-2">
          taab records the payment — the money itself moves however you usually pay.
        </Text>
      </View>

      <View className="mt-6">
        <FormInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Transfer ref 0021" maxLength={140} />
      </View>
    </Screen>
  );
}
