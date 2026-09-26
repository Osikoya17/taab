import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Button } from '@/components/ui/Button';
import { CodeInput } from '@/components/ui/CodeInput';
import { FormInput } from '@/components/ui/FormInput';
import { useAuthActions } from '@/features/auth/auth-context';
import { resetCompleteSchema, resetRequestSchema, type ResetCompleteValues, type ResetRequestValues } from '@/features/auth/schemas';
import { toast } from '@/store/toast.store';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const actions = useAuthActions();
  const [email, setEmail] = useState<string | null>(null);

  const request = useForm<ResetRequestValues>({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: '' } });
  const complete = useForm<ResetCompleteValues>({ resolver: zodResolver(resetCompleteSchema), defaultValues: { code: '', password: '' } });

  const sendCode = request.handleSubmit(async (values) => {
    const result = await actions.startPasswordReset(values.email);
    if (result.status === 'error') request.setError('email', { message: result.message });
    else setEmail(values.email.trim());
  });

  const reset = complete.handleSubmit(async ({ code, password }) => {
    const result = await actions.completePasswordReset(code, password);
    if (result.status === 'error') {
      complete.setError(result.field === 'password' ? 'password' : 'code', { message: result.message });
      return;
    }
    toast.success('Password updated');
    // Clerk signs the user in after a reset; the guards take it from there.
    if (router.canGoBack()) router.back();
  });

  if (!email) {
    return (
      <AuthScaffold back title="Reset your password" subtitle="Enter your email and we’ll send you a code.">
        <Controller
          control={request.control}
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
              autoFocus
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
          )}
        />
        <Button label="Send code" onPress={sendCode} loading={request.formState.isSubmitting} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold back title="Choose a new password" subtitle={`Enter the code we sent to ${email}.`}>
      <Controller
        control={complete.control}
        name="code"
        render={({ field, fieldState }) => <CodeInput value={field.value} onChange={field.onChange} error={fieldState.error?.message} />}
      />
      <Controller
        control={complete.control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordInput
            label="New password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint="At least 8 characters."
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />
      <Button label="Update password" onPress={reset} loading={complete.formState.isSubmitting} />
    </AuthScaffold>
  );
}
