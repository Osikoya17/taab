import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { usePreferences, type Appearance } from '@/store/preferences.store';

const APPEARANCE_OPTIONS: { value: Appearance; label: string; detail: string }[] = [
  { value: 'system', label: 'System', detail: 'Match your device' },
  { value: 'light', label: 'Light', detail: 'Warm white' },
  { value: 'dark', label: 'Dark', detail: 'Easy on the eyes at night' },
];

export default function AppearanceScreen() {
  const appearance = usePreferences((s) => s.appearance);
  const setAppearance = usePreferences((s) => s.setAppearance);

  return (
    <Screen header={<AppHeader back title="Appearance" />}>
      <Text variant="body" tone="muted" className="pt-2">
        Choose how taab looks on this device.
      </Text>
      <View className="mt-5 gap-2" accessibilityRole="radiogroup">
        {APPEARANCE_OPTIONS.map((option) => (
          <ChoiceRow
            key={option.value}
            label={option.label}
            detail={option.detail}
            selected={appearance === option.value}
            onPress={() => {
              if (appearance === option.value) return;
              haptics.selection();
              setAppearance(option.value);
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
