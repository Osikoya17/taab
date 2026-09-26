import Constants from 'expo-constants';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TaabLogo } from '@/components/ui/TaabLogo';
import { Text } from '@/components/ui/Text';
import { useAuthSession } from '@/features/auth/auth-context';
import { queryClient } from '@/lib/query-client';
import { resetDatabase } from '@/services/mock/db';
import { toast } from '@/store/toast.store';

export default function AboutScreen() {
  const { mode } = useAuthSession();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen header={<AppHeader back title="About" />}>
      <View className="items-center pt-10">
        <TaabLogo size="large" />
        <Text variant="body" tone="muted" className="mt-4 text-center">
          Add a bill. Split the tab.{'\n'}taab keeps track of the rest.
        </Text>
        <Text variant="caption" tone="faint" className="mt-6">
          Version {version}
        </Text>
      </View>

      {mode === 'demo' ? (
        <View className="mt-12 rounded-card border border-dashed border-line-strong p-4">
          <Text variant="bodyStrong">Demo data</Text>
          <Text variant="caption" tone="muted" className="mt-0.5">
            Clears every demo account and taab on this device. Sign out and back in to start fresh.
          </Text>
          <View className="mt-3">
            <Button
              label="Reset demo data"
              size="md"
              variant="secondary"
              onPress={async () => {
                await resetDatabase();
                queryClient.clear();
                toast.show('Demo data cleared');
              }}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
