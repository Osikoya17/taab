import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { Button } from '@/components/ui/Button';
import { CodeInput } from '@/components/ui/CodeInput';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useAuthActions } from '@/features/auth/auth-context';
import { toast } from '@/store/toast.store';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const { flow = 'sign-up', email = '' } = useLocalSearchParams<{ flow?: 'sign-up' | 'sign-in'; email?: string }>();
  const actions = useAuthActions();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verify(value = code) {
    if (value.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(undefined);
    const result = flow === 'sign-in' ? await actions.verifySignInCode(value) : await actions.verifySignUpCode(value);
    setSubmitting(false);
    if (result.status === 'error') {
      setError(result.message);
      setCode('');
    }
  }

  async function resend() {
    const result = await actions.resendCode(flow);
    if (result.status === 'error') toast.error(result.message);
    else {
      toast.show('New code sent', `Check ${email}`);
      setCooldown(RESEND_SECONDS);
    }
  }

  return (
    <AuthScaffold back title="Check your email" subtitle={`We sent a 6-digit code to ${email || 'your email'}.`}>
      <CodeInput value={code} onChange={setCode} error={error} onComplete={verify} />
      <Button label="Verify" onPress={() => verify()} loading={submitting} disabled={code.length !== 6} />
      <View className="items-center">
        {cooldown > 0 ? (
          <Text variant="label" tone="faint">
            Resend code in {cooldown}s
          </Text>
        ) : (
          <PressableScale onPress={resend} accessibilityLabel="Resend code" hitSlop={12} className="py-2">
            <Text variant="label">Resend code</Text>
          </PressableScale>
        )}
      </View>
    </AuthScaffold>
  );
}
