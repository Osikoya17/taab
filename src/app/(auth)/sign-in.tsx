import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, View } from 'react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { OrDivider, SocialButtons } from '@/components/auth/SocialButtons';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { Text } from '@/components/ui/Text';
import { useAuthActions, useAuthSession } from '@/features/auth/auth-context';
import { DEMO_ACCOUNT } from '@/features/auth/demo-auth-provider';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';

export default function SignInScreen() {
  const router = useRouter();
  const actions = useAuthActions();
  const { mode } = useAuthSession();
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit, setError, setValue, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const result = await actions.signInWithPassword(email, password);
    if (result.status === 'needs_verification') {
      router.push({ pathname: '/verify', params: { flow: 'sign-in', email: result.email } });
    } else if (result.status === 'error') {
      setError(result.field === 'email' ? 'email' : 'password', { message: result.message });
    }
    // On success the route guards move us into the app.
  });

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in to see where you stand."
      footer={
        <View className="flex-row items-center gap-1">
          <Text variant="body" tone="muted">
            New to taab?
          </Text>
          <Link href="/sign-up" replace accessibilityRole="link">
            <Text variant="bodyStrong">Create an account</Text>
          </Link>
        </View>
      }>
      <SocialButtons />
      <OrDivider />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormInput
            label="Email"
            icon={Mail}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={passwordRef}
            label="Password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        )}
      />
      <Link href="/forgot-password" asChild>
        <Text variant="label" tone="muted" className="self-end py-1" accessibilityRole="link">
          Forgot password?
        </Text>
      </Link>
      <Button label="Sign in" onPress={onSubmit} loading={formState.isSubmitting} />
      {mode === 'demo' ? (
        <Button
          label="Explore as Ranmi"
          variant="ghost"
          onPress={() => {
            setValue('email', DEMO_ACCOUNT.email);
            setValue('password', 'taab-demo');
            onSubmit();
          }}
        />
      ) : null}
    </AuthScaffold>
  );
}
