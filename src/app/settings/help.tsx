import { useRouter } from 'expo-router';
import { Compass, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { env } from '@/lib/env';
import { usePreferences } from '@/store/preferences.store';

const FAQ = [
  {
    q: 'How does taab work out who owes who?',
    a: 'Every expense records who paid and each person’s share. taab adds it all up, then suggests the fewest payments that get everyone square.',
  },
  {
    q: 'Does taab move money?',
    a: 'Not yet. Pay however you usually do — bank transfer, cash — then record it in taab so balances stay accurate.',
  },
  {
    q: 'What does “simplify debts” change?',
    a: 'Only the suggested payments. Your expense history stays exactly as it was entered.',
  },
  {
    q: 'Can I split unevenly?',
    a: 'Yes. Split equally, by exact amounts, by percentages or by shares. Every split method is free.',
  },
  {
    q: 'What if someone isn’t on taab yet?',
    a: 'Invite them by email, phone or link. You can include them in splits straight away.',
  },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);
  const router = useRouter();
  const replayTour = usePreferences((s) => s.replayTour);
  return (
    <Screen header={<AppHeader back title="Help" />}>
      <Surface className="mt-2 flex-row items-center gap-3">
        <View className="flex-1">
          <Text variant="bodyStrong">New to taab?</Text>
          <Text variant="caption" tone="muted" className="mt-0.5">
            A quick tour of Home, the + button and your taabs.
          </Text>
        </View>
        <Button
          label="Show me around"
          icon={Compass}
          size="md"
          fullWidth={false}
          onPress={() => {
            replayTour();
            router.navigate('/');
          }}
        />
      </Surface>
      <Surface padded={false} className="mt-4 px-4">
        {FAQ.map((item, i) => (
          <View key={item.q}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => setOpen(open === i ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
              className="py-4">
              <Text variant="bodyStrong">{item.q}</Text>
              {open === i ? (
                <Text variant="body" tone="muted" className="mt-2">
                  {item.a}
                </Text>
              ) : null}
            </Pressable>
          </View>
        ))}
      </Surface>
      <View className="mt-8 items-center gap-3">
        <Text variant="body" tone="muted">
          Still stuck? We’re happy to help.
        </Text>
        <Button label="Email support" icon={Mail} variant="secondary" fullWidth={false} onPress={() => Linking.openURL(`mailto:${env.supportEmail}`)} />
      </View>
    </Screen>
  );
}
