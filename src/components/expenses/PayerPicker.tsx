import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { PressableScale } from '@/components/ui/PressableScale';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { CURRENCIES } from '@/constants/currencies';
import { fonts, noFocusRing, useColors } from '@/constants/theme';
import type { CurrencyCode, GroupMember } from '@/types/models';

export type PayerPickerProps = {
  members: GroupMember[];
  meId: string;
  currency: CurrencyCode;
  payerIds: string[];
  payerMode: 'equal' | 'custom';
  payerAmounts: Record<string, string>;
  onChange: (next: { payerIds: string[]; payerMode: 'equal' | 'custom'; payerAmounts: Record<string, string> }) => void;
  error?: string;
};

function payerSummary(members: GroupMember[], payerIds: string[], meId: string) {
  const names = payerIds.map((id) => (id === meId ? 'You' : (members.find((m) => m.userId === id)?.name ?? 'Someone')));
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]} and ${names.length - 1} others`;
}

/** "Paid by" row that opens a sheet for one or several payers. */
export function PayerPicker({ members, meId, currency, payerIds, payerMode, payerAmounts, onChange, error }: PayerPickerProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState(payerIds);
  const [draftMode, setDraftMode] = useState(payerMode);
  const [draftAmounts, setDraftAmounts] = useState(payerAmounts);

  function openSheet() {
    setDraftIds(payerIds);
    setDraftMode(payerMode);
    setDraftAmounts(payerAmounts);
    setOpen(true);
  }

  function toggle(id: string) {
    setDraftIds((ids) => (ids.includes(id) ? (ids.length === 1 ? ids : ids.filter((x) => x !== id)) : [...ids, id]));
  }

  const people = payerIds.map((id) => members.find((m) => m.userId === id)).filter((m): m is GroupMember => !!m);

  return (
    <>
      <PressableScale
        onPress={openSheet}
        accessibilityLabel={`Paid by ${payerSummary(members, payerIds, meId)}. Change`}
        pressedScale={0.99}
        className="flex-row items-center justify-between rounded-input border border-line bg-surface px-4 py-3">
        <View className="flex-row items-center gap-3">
          <AvatarStack people={people.map((p) => ({ id: p.userId, name: p.name, avatarUrl: p.avatarUrl }))} size={30} max={3} />
          <View>
            <Text variant="caption" tone="muted">
              Paid by
            </Text>
            <Text variant="bodyStrong">{payerSummary(members, payerIds, meId)}</Text>
          </View>
        </View>
        <ChevronDown size={18} color={colors.muted} />
      </PressableScale>
      {error ? (
        <Text variant="caption" tone="negative" className="mt-1.5">
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Who paid?" description="Choose one person, or several if the bill was shared.">
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          {members.map((m, index) => {
            const selected = draftIds.includes(m.userId);
            return (
              <View key={m.userId}>
                {index > 0 ? <Divider inset={52} /> : null}
                <Pressable
                  onPress={() => toggle(m.userId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={m.userId === meId ? 'You' : m.name}
                  className="min-h-[56px] flex-row items-center gap-3 py-2">
                  <Avatar name={m.name} uri={m.avatarUrl} seed={m.userId} size={40} />
                  <Text variant="bodyStrong" className="flex-1">
                    {m.userId === meId ? 'You' : m.name}
                  </Text>
                  {selected && draftIds.length > 1 && draftMode === 'custom' ? (
                    <View className="h-11 w-32 flex-row items-center rounded-2xl border border-line px-3">
                      <Text variant="body" tone="muted">
                        {CURRENCIES[currency].symbol}
                      </Text>
                      <TextInput
                        value={draftAmounts[m.userId] ?? ''}
                        onChangeText={(t) => setDraftAmounts((a) => ({ ...a, [m.userId]: t }))}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.faint}
                        accessibilityLabel={`Amount paid by ${m.name}`}
                        style={[{ flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, textAlign: 'right' }, noFocusRing]}
                      />
                    </View>
                  ) : (
                    <View
                      className="h-6 w-6 items-center justify-center rounded-full border"
                      style={{ backgroundColor: selected ? colors.ink : 'transparent', borderColor: selected ? colors.ink : colors.lineStrong }}>
                      {selected ? <Check size={13} color={colors.canvas} strokeWidth={3} /> : null}
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
        {draftIds.length > 1 ? (
          <View className="mt-3">
            <SegmentedControl
              accessibilityLabel="How the payers split the bill"
              value={draftMode}
              onChange={setDraftMode}
              segments={[
                { value: 'equal', label: 'Paid equally' },
                { value: 'custom', label: 'Set amounts' },
              ]}
            />
          </View>
        ) : null}
        <View className="mt-4">
          <Button
            label="Done"
            onPress={() => {
              onChange({ payerIds: draftIds, payerMode: draftIds.length > 1 ? draftMode : 'equal', payerAmounts: draftAmounts });
              setOpen(false);
            }}
          />
        </View>
      </BottomSheet>
    </>
  );
}
