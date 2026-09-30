import { Image } from 'expo-image';
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Chip } from '@/components/ui/Chip';
import { FormInput } from '@/components/ui/FormInput';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { useColors } from '@/constants/theme';
import { CATEGORIES } from '@/features/expenses/categories';
import { pickReceiptPhotos } from '@/features/expenses/receipt-photo';
import { useReceiptImage } from '@/features/expenses/use-receipt-image';
import type { ExpenseCategory } from '@/types/models';
import { dayLabel, longDate } from '@/utils/dates';
import { toast } from '@/store/toast.store';

export type MoreOptionsValue = {
  date: string;
  notes: string;
  category?: string;
  receiptUri?: string;
  repeat: 'off' | 'weekly' | 'monthly';
  repeatAuto: boolean;
};

export type MoreOptionsProps = {
  value: MoreOptionsValue;
  onChange: (patch: Partial<MoreOptionsValue>) => void;
  /** Recurring rules only make sense when creating, not editing. */
  allowRepeat: boolean;
  defaultOpen?: boolean;
};

function shiftDay(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Optional fields, tucked away so the default flow stays fast. */
export function MoreOptions({ value, onChange, allowRepeat, defaultOpen = false }: MoreOptionsProps) {
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const isToday = dayLabel(value.date) === 'Today';
  const receiptPreview = useReceiptImage(value.receiptUri);

  async function attachReceipt(source: 'camera' | 'library') {
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
      onChange({ receiptUri: result.photos[0] });
    } catch { toast.error('Couldn’t attach the photo', 'Try again.'); }
  }

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="More options"
        className="flex-row items-center gap-1.5 self-start py-2">
        <Text variant="label">More options</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={16} color={colors.ink} />
        </View>
      </Pressable>

      {open ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          <View className="gap-5 pt-2">
            <View>
              <Text variant="label" tone="muted" className="mb-2">
                Date
              </Text>
              <View className="flex-row items-center justify-between rounded-input border border-line bg-surface px-2 py-1.5">
                <IconButton icon={ChevronLeft} variant="plain" accessibilityLabel="Previous day" onPress={() => onChange({ date: shiftDay(value.date, -1) })} />
                <View className="items-center">
                  <Text variant="bodyStrong">{dayLabel(value.date)}</Text>
                  <Text variant="caption" tone="muted">
                    {longDate(value.date)}
                  </Text>
                </View>
                <IconButton
                  icon={ChevronRight}
                  variant="plain"
                  accessibilityLabel="Next day"
                  disabled={isToday}
                  onPress={() => onChange({ date: shiftDay(value.date, 1) })}
                />
              </View>
            </View>

            <View>
              <Text variant="label" tone="muted" className="mb-2">
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    icon={c.icon}
                    selected={value.category === c.value}
                    onPress={() => onChange({ category: value.category === c.value ? undefined : (c.value as ExpenseCategory) })}
                  />
                ))}
              </ScrollView>
            </View>

            <FormInput label="Notes" placeholder="Anything worth remembering" value={value.notes} onChangeText={(notes) => onChange({ notes })} multiline maxLength={500} />

            <View>
              <Text variant="label" tone="muted" className="mb-2">
                Receipt
              </Text>
              {value.receiptUri ? (
                <View className="self-start">
                  <Image source={receiptPreview ? { uri: receiptPreview } : undefined} style={{ width: 96, height: 120, borderRadius: 16, backgroundColor: colors.sunken }} contentFit="cover" accessibilityLabel="Receipt photo" />
                  <View className="absolute -right-2 -top-2">
                    <IconButton icon={X} size={28} accessibilityLabel="Remove receipt" onPress={() => onChange({ receiptUri: undefined })} />
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <PressableScale
                    onPress={() => attachReceipt('camera')}
                    accessibilityLabel="Take a photo of the receipt"
                    className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-input border border-dashed border-line-strong">
                    <Camera size={18} color={colors.muted} strokeWidth={1.8} />
                    <Text variant="label" tone="muted">
                      Take photo
                    </Text>
                  </PressableScale>
                  <PressableScale
                    onPress={() => attachReceipt('library')}
                    accessibilityLabel="Choose a receipt photo"
                    className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-input border border-dashed border-line-strong">
                    <ImageIcon size={18} color={colors.muted} strokeWidth={1.8} />
                    <Text variant="label" tone="muted">
                      Choose photo
                    </Text>
                  </PressableScale>
                </View>
              )}
            </View>

            {allowRepeat ? (
              <View>
                <Text variant="label" tone="muted" className="mb-2">
                  Repeat
                </Text>
                <View className="flex-row gap-2">
                  {(['off', 'weekly', 'monthly'] as const).map((r) => (
                    <Chip
                      key={r}
                      label={r === 'off' ? 'Never' : r === 'weekly' ? 'Weekly' : 'Monthly'}
                      selected={value.repeat === r}
                      onPress={() => onChange({ repeat: r })}
                    />
                  ))}
                </View>
                {value.repeat !== 'off' ? (
                  <View className="mt-3 flex-row items-center justify-between rounded-input border border-line bg-surface px-4 py-3">
                    <View className="flex-1 pr-3">
                      <Text variant="bodyStrong">Add automatically</Text>
                      <Text variant="caption" tone="muted">
                        {value.repeatAuto ? 'taab adds it on the day.' : 'We’ll ask you to confirm first.'}
                      </Text>
                    </View>
                    <Toggle value={value.repeatAuto} onValueChange={(repeatAuto) => onChange({ repeatAuto })} accessibilityLabel="Add automatically" />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
