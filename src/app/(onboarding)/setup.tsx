import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { FormInput } from '@/components/ui/FormInput';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { CURRENCIES, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { useAuthSession } from '@/features/auth/auth-context';
import { useCompleteSetup } from '@/features/profile/queries';
import { USE_CASES } from '@/features/profile/use-cases';
import { haptics } from '@/lib/haptics';
import { captureEvent } from '@/lib/posthog';
import { toast } from '@/store/toast.store';
import type { CurrencyCode, UseCase } from '@/types/models';

type Step = 'name' | 'use' | 'currency';

export default function SetupScreen() {
  const { user, mode } = useAuthSession();
  const initialName = user?.firstName ?? user?.fullName ?? '';
  const steps: Step[] = initialName ? ['use', 'currency'] : ['name', 'use', 'currency'];

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState(initialName);
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [includeSamples, setIncludeSamples] = useState(mode === 'demo');
  const complete = useCompleteSetup();

  const step = steps[stepIndex];
  const canContinue = step === 'name' ? name.trim().length > 0 : step === 'use' ? !!useCase : true;

  async function next() {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    try {
      await complete.mutateAsync({ name: name.trim(), useCase: useCase ?? 'other', currency, includeSampleTaabs: includeSamples });
      captureEvent('onboarding_completed', {
        use_case: useCase ?? 'other',
        currency,
        included_sample_taabs: includeSamples,
      });
      haptics.success();
    } catch {
      toast.error('Couldn’t finish setting up', 'Check your connection and try again.');
    }
  }

  return (
    <Screen
      keyboard
      footer={
        <View className="flex-row items-center gap-3">
          {stepIndex > 0 ? <IconButton icon={ArrowLeft} accessibilityLabel="Back" size={56} onPress={() => setStepIndex(stepIndex - 1)} /> : null}
          <View className="flex-1">
            <Button
              label={stepIndex === steps.length - 1 ? 'Start using taab' : 'Continue'}
              disabled={!canContinue}
              loading={complete.isPending}
              onPress={next}
            />
          </View>
        </View>
      }>
      <Text variant="micro" tone="muted" className="mt-6">
        {stepIndex + 1} of {steps.length}
      </Text>

      <Animated.View key={step} entering={FadeInRight.duration(260)}>
        {step === 'name' ? (
          <View className="mt-3 gap-6">
            <View>
              <Text variant="title">What should we call you?</Text>
              <Text variant="body" tone="muted" className="mt-2">
                This is how you’ll appear to people in your taabs.
              </Text>
            </View>
            <FormInput label="Display name" value={name} onChangeText={setName} placeholder="Ranmi" autoFocus autoCapitalize="words" maxLength={40} />
          </View>
        ) : null}

        {step === 'use' ? (
          <View className="mt-3 gap-6">
            <View>
              <Text variant="title">What will you mostly use taab for?</Text>
              <Text variant="body" tone="muted" className="mt-2">
                Just so we can suggest the right examples.
              </Text>
            </View>
            <View className="gap-2">
              {USE_CASES.map((u) => (
                <ChoiceRow
                  key={u.value}
                  label={u.label}
                  selected={useCase === u.value}
                  onPress={() => {
                    haptics.selection();
                    setUseCase(u.value);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 'currency' ? (
          <View className="mt-3 gap-6">
            <View>
              <Text variant="title">Your default currency</Text>
              <Text variant="body" tone="muted" className="mt-2">
                New taabs start in this currency. You can change it any time.
              </Text>
            </View>
            <View className="gap-2">
              {SUPPORTED_CURRENCIES.map((code) => (
                <ChoiceRow
                  key={code}
                  label={`${code} — ${CURRENCIES[code].name}`}
                  selected={currency === code}
                  onPress={() => setCurrency(code)}
                />
              ))}
            </View>
            <View className="flex-row items-center justify-between rounded-input border border-line bg-surface px-4 py-3">
              <View className="flex-1 pr-3">
                <Text variant="bodyStrong">Start with sample taabs</Text>
                <Text variant="caption" tone="muted">
                  Explore with Flat 12, Detty December and Weekend Trip.
                </Text>
              </View>
              <Toggle value={includeSamples} onValueChange={setIncludeSamples} accessibilityLabel="Start with sample taabs" />
            </View>
          </View>
        ) : null}
      </Animated.View>
    </Screen>
  );
}
