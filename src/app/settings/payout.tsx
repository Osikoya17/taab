import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EMPTY_PAYOUT, PayoutForm } from '@/components/payouts/PayoutForm';
import { AppHeader } from '@/components/ui/AppHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { cleanAccountNumber, formatAccountNumber, validatePayout, type PayoutFormErrors } from '@/features/payouts/banks';
import { useMyPayouts, useSetDefaultPayout, useSetGroupPayout } from '@/features/payouts/queries';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast.store';
import type { PayoutAccount } from '@/types/models';

function tidy(account: PayoutAccount): PayoutAccount {
  return { bankName: account.bankName.trim(), accountNumber: cleanAccountNumber(account.accountNumber), accountName: account.accountName.trim() };
}

/**
 * Where people in your taabs should send what they owe you. One usual
 * account, and optionally a different one for any taab.
 */
export default function PayoutSettingsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const mine = useMyPayouts();
  const setDefault = useSetDefaultPayout();
  const setGroup = useSetGroupPayout();
  const [draft, setDraft] = useState<PayoutAccount | null>(null);
  const [errors, setErrors] = useState<PayoutFormErrors>({});
  const [editing, setEditing] = useState<string | null>(null);
  // Opened from a taab's menu: start on that taab's account until it's closed.
  const [autoClosed, setAutoClosed] = useState(false);

  const saved = mine.data?.default;
  const form = draft ?? saved ?? EMPTY_PAYOUT;

  const activeId = editing ?? (!autoClosed && groupId ? groupId : null);
  const active = mine.data?.groups.find((g) => g.groupId === activeId);

  async function saveDefault() {
    const account = tidy(form);
    const found = validatePayout(account);
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await setDefault.mutateAsync(account);
      setDraft(null);
      haptics.success();
      toast.success('Bank details saved', 'People in your taabs can now see where to pay you.');
    } catch {
      toast.error('Couldn’t save that', 'Check the details and your connection, then try again.');
    }
  }

  async function removeDefault() {
    try {
      await setDefault.mutateAsync(null);
      setDraft(EMPTY_PAYOUT);
      toast.show('Bank details removed');
    } catch {
      toast.error('Couldn’t remove them', 'Try again.');
    }
  }

  function closeSheet() {
    setEditing(null);
    setAutoClosed(true);
  }

  if (mine.isError) {
    return (
      <Screen header={<AppHeader back title="Bank account" />}>
        <ErrorState title="Couldn’t load your bank details." onRetry={() => mine.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen keyboard header={<AppHeader back title="Bank account" />}>
      <Text variant="body" tone="muted" className="pt-2">
        Add where you’d like to be paid back. People in your taabs see it when they settle up, and transfer from their own bank.
      </Text>

      {!mine.data ? (
        <View className="mt-6">
          <LoadingSkeleton rows={3} />
        </View>
      ) : (
        <>
          <Text variant="label" tone="muted" className="mb-2 mt-6">
            Your usual account
          </Text>
          <Surface className="gap-4">
            <PayoutForm value={form} onChange={(next) => { setDraft(next); setErrors({}); }} errors={errors} />
            <Button label={saved ? 'Save changes' : 'Save bank details'} onPress={saveDefault} loading={setDefault.isPending} />
            {saved ? <Button label="Remove" variant="ghost" onPress={removeDefault} disabled={setDefault.isPending} /> : null}
          </Surface>

          {mine.data.groups.length ? (
            <>
              <Text variant="label" tone="muted" className="mb-2 mt-7">
                A different account for a taab
              </Text>
              <Surface padded={false}>
                {mine.data.groups.map((g, i) => (
                  <View key={g.groupId}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={g.groupName}
                      detail={g.account ? `${g.account.bankName} · ${formatAccountNumber(g.account.accountNumber)}` : saved ? 'Uses your usual account' : 'No account yet'}
                      onPress={() => setEditing(g.groupId)}
                    />
                  </View>
                ))}
              </Surface>
            </>
          ) : null}

          <Text variant="caption" tone="faint" className="mt-5 px-1">
            Only people in the same taab can see these details. taab never holds or moves your money.
          </Text>
        </>
      )}

      <BottomSheet
        visible={!!active}
        onClose={closeSheet}
        title={active ? `Account for ${active.groupName}` : ''}
        description="People in this taab will see this account instead of your usual one.">
        {active ? (
          <GroupAccountForm
            key={active.groupId}
            initial={active.account ?? saved ?? EMPTY_PAYOUT}
            hasOwn={!!active.account}
            saving={setGroup.isPending}
            onSave={async (account) => {
              try {
                await setGroup.mutateAsync({ groupId: active.groupId, account });
                haptics.success();
                toast.show(account ? `Saved for ${active.groupName}` : `${active.groupName} uses your usual account`);
                closeSheet();
              } catch {
                toast.error('Couldn’t save that', 'Check the details and your connection, then try again.');
              }
            }}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/** One taab's account. Mounted per taab, so it starts from that taab's saved details. */
function GroupAccountForm({ initial, hasOwn, saving, onSave }: { initial: PayoutAccount; hasOwn: boolean; saving: boolean; onSave: (account: PayoutAccount | null) => void }) {
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<PayoutFormErrors>({});
  function save() {
    const account = tidy(value);
    const found = validatePayout(account);
    setErrors(found);
    if (!Object.keys(found).length) onSave(account);
  }
  return (
    <View className="gap-3">
      <PayoutForm value={value} onChange={(next) => { setValue(next); setErrors({}); }} errors={errors} />
      <Button label="Save for this taab" onPress={save} loading={saving} />
      {hasOwn ? <Button label="Use my usual account" variant="ghost" onPress={() => onSave(null)} disabled={saving} /> : null}
    </View>
  );
}
