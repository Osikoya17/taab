import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Mail, UserRound } from 'lucide-react-native';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, View } from 'react-native';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { OrDivider, SocialButtons } from '@/components/auth/SocialButtons';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { Text } from '@/components/ui/Text';
import { useAuthActions } from '@/features/auth/auth-context';
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas';

export default function SignUpScreen() {
  const router = useRouter();
  const actions = useAuthActions();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit, setError, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await actions.signUp(values);
    if (result.status === 'needs_verification') {
      router.push({ pathname: '/verify', params: { flow: 'sign-up', email: result.email } });
    } else if (result.status === 'error') {
      setError(result.field === 'email' ? 'email' : result.field === 'name' ? 'name' : 'password', { message: result.message });
    }
  });

  return (
    <AuthScaffold
      title="Create your taab"
      subtitle="Split the tab. taab keeps track of the rest."
      footer={
        <View className="flex-row items-center gap-1">
          <Text variant="body" tone="muted">
            Already have an account?
          </Text>
          <Link href="/sign-in" replace accessibilityRole="link">
            <Text variant="bodyStrong">Sign in</Text>
          </Link>
        </View>
      }>
      <SocialButtons />
      <OrDivider />
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            label="Your name"
            icon={UserRound}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="Ranmi"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormInput
            ref={emailRef}
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
            hint="At least 8 characters."
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        )}
      />
      <Button label="Continue" onPress={onSubmit} loading={formState.isSubmitting} />
      {/* Clerk renders its bot-protection widget here on web; native skips it. */}
      <View nativeID="clerk-captcha" />
    </AuthScaffold>
  );
}
