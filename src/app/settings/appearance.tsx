import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

export default function AppearanceScreen() {
  return (
    <Screen header={<AppHeader back title="Appearance" />}>
      <Text variant="body" tone="muted" className="pt-2">
        taab is designed around a calm, warm-white look.
      </Text>
      <View className="mt-5 gap-2">
        <ChoiceRow label="Light" detail="Warm white" selected onPress={() => undefined} />
      </View>
      <View className="mt-6 rounded-card border border-dashed border-line-strong px-4 py-4">
        <Text variant="bodyStrong">Dark and premium themes</Text>
        <Text variant="caption" tone="muted" className="mt-0.5">
          Not available yet. The current app uses the light theme.
        </Text>
      </View>
    </Screen>
  );
}
