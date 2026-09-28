import { Check } from 'lucide-react-native';
import { TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { CURRENCIES } from '@/constants/currencies';
import { colors, fonts, noFocusRing } from '@/constants/theme';
import type { SplitPreview } from '@/features/expenses/expense-form';
import type { CurrencyCode, GroupMember, SplitMethod } from '@/types/models';

const METHODS: { value: SplitMethod; label: string }[] = [
  { value: 'equal', label: 'Equally' },
  { value: 'exact', label: 'Exact' },
  { value: 'percentage', label: '%' },
  { value: 'shares', label: 'Shares' },
];

const PREMIUM: SplitMethod[] = ['percentage', 'shares'];

export type SplitBreakdownProps = {
  method: SplitMethod;
  onMethodChange: (method: SplitMethod) => void;
  participants: GroupMember[];
  values: Record<string, string>;
  onValueChange: (userId: string, text: string) => void;
  preview: SplitPreview;
  currency: CurrencyCode;
  meId: string;
  advancedUnlocked: boolean;
};

function ValueInput({ method, value, onChange, label, currency }: { method: SplitMethod; value: string; onChange: (t: string) => void; label: string; currency: CurrencyCode }) {
  const prefix = method === 'exact' ? CURRENCIES[currency].symbol : undefined;
  const suffix = method === 'percentage' ? '%' : method === 'shares' ? '×' : undefined;
  return (
    <View className="h-11 w-[108px] flex-row items-center rounded-2xl border border-line bg-canvas px-3">
      {prefix ? (
        <Text variant="body" tone="muted">
          {prefix}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={method === 'shares' ? 'number-pad' : 'decimal-pad'}
        placeholder={method === 'shares' ? '1' : '0'}
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        maxFontSizeMultiplier={1.3}
        style={[{ flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, textAlign: 'right', paddingVertical: 8 }, noFocusRing]}
      />
      {suffix ? (
        <Text variant="body" tone="muted" className="ml-1">
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

/** Split method + per-person shares, with a live "adds up" check. */
export function SplitBreakdown({ method, onMethodChange, participants, values, onValueChange, preview, currency, meId, advancedUnlocked }: SplitBreakdownProps) {
  return (
    <View>
      <Text variant="label" tone="muted" className="mb-2">
        Split method
      </Text>
      <SegmentedControl
        accessibilityLabel="Split method"
        value={method}
        onChange={onMethodChange}
        segments={METHODS.map((m) => ({ ...m, locked: !advancedUnlocked && PREMIUM.includes(m.value) }))}
      />

      <View className="mt-3 rounded-card border border-line bg-surface px-4">
        {participants.map((m, index) => {
          const name = m.userId === meId ? 'You' : m.name;
          const amount = preview.amounts[m.userId];
          return (
            <View key={m.userId}>
              {index > 0 ? <Divider /> : null}
              <View className="min-h-[60px] flex-row items-center gap-3 py-2">
                <Avatar name={m.name} uri={m.avatarUrl} seed={m.userId} size={32} />
                <View className="flex-1">
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </Text>
                  {method !== 'equal' && method !== 'exact' && amount !== undefined ? (
                    <Money amount={amount} currency={currency} size="small" tone="muted" convert={false} />
                  ) : null}
                </View>
                {method === 'equal' ? (
                  amount !== undefined ? <Money amount={amount} currency={currency} size="body" convert={false} /> : null
                ) : (
                  <ValueInput
                    method={method}
                    value={values[m.userId] ?? ''}
                    onChange={(t) => onValueChange(m.userId, t)}
                    label={`${name} ${method === 'exact' ? 'amount' : method === 'percentage' ? 'percentage' : 'shares'}`}
                    currency={currency}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View className="mt-2 min-h-[20px] flex-row items-center gap-1.5 px-1" accessibilityLiveRegion="polite">
        {preview.ok ? (
          <>
            <Check size={14} color={colors.positive} strokeWidth={2.4} />
            <Text variant="caption" tone="positive">
              Adds up
            </Text>
          </>
        ) : (
          <Text variant="caption" tone={preview.message === 'Enter an amount first' ? 'faint' : 'negative'}>
            {preview.message}
          </Text>
        )}
      </View>
    </View>
  );
}
