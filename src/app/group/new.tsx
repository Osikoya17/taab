import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { z } from 'zod';

import { MemberInviter, type PendingInvite } from '@/components/groups/MemberInviter';
import { SheetHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FormInput } from '@/components/ui/FormInput';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { OPERATIONAL_LIMITS } from '@/features/billing/products';
import { GROUP_TYPES } from '@/features/groups/group-types';
import { useCreateGroup } from '@/features/groups/queries';
import { useProfile } from '@/features/profile/queries';
import { suggestedGroupName } from '@/features/profile/use-cases';
import { haptics } from '@/lib/haptics';
import { captureEvent } from '@/lib/posthog';
import { isServiceError } from '@/services/api/errors';
import { toast } from '@/store/toast.store';
import { useGoBack } from '@/hooks/use-go-back';

const schema = z.object({
  name: z.string().trim().min(1, 'Give your taab a name').max(40, 'Keep it under 40 characters'),
  description: z.string().max(120, 'Keep it short'),
  type: z.enum(['home', 'trip', 'friends', 'couple', 'event', 'work', 'other']),
  currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']),
});

type Values = z.infer<typeof schema>;

function Label({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted" className="mb-2">
      {children}
    </Text>
  );
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const { data: profile } = useProfile();
  const create = useCreateGroup();
  const [invites, setInvites] = useState<PendingInvite[]>([]);

  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', type: 'friends', currency: profile?.defaultCurrency ?? DEFAULT_CURRENCY },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const group = await create.mutateAsync({
        ...values,
        invites: invites.map(({ key: _key, label: _label, detail: _detail, ...invite }) => invite),
      });
      captureEvent('group_created', {
        group_type: values.type,
        currency: values.currency,
        invited_member_count: invites.length,
      });
      haptics.success();
      toast.success(`${group.name} is ready`, invites.length ? 'We’ve let everyone know.' : 'Invite people any time.');
      router.replace(`/group/${group.id}`);
    } catch (error) {
      if (isServiceError(error) && error.code === 'limit_reached') {
        toast.error(`You’re in ${OPERATIONAL_LIMITS.activeGroups} taabs`, 'That’s the most one account can have. Leave a finished taab to make room.');
      } else {
        toast.error('Couldn’t create that taab', 'Check your connection and try again.');
      }
    }
  });

  return (
    <Screen
      keyboard
      safeTop={false}
      header={<SheetHeader title="Create a taab" onCancel={() => goBack('/groups')} />}
      footer={<Button label="Create taab" onPress={onSubmit} loading={formState.isSubmitting} />}>
      <View className="gap-6 pt-3">
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <FormInput
              label="Name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder={suggestedGroupName(profile?.useCase)}
              autoFocus
              autoCapitalize="words"
              maxLength={40}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <FormInput
              label="Description (optional)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder="What’s this taab for?"
              maxLength={120}
            />
          )}
        />
        <View>
          <Label>Type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
                {GROUP_TYPES.map((t) => (
                  <Chip key={t.value} label={t.label} icon={t.icon} iconColour={t.colour} selected={field.value === t.value} onPress={() => field.onChange(t.value)} />
                ))}
              </ScrollView>
            )}
          />
        </View>
        <View>
          <Label>Currency</Label>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <View className="flex-row flex-wrap gap-2">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <Chip key={c} label={c} selected={field.value === c} onPress={() => field.onChange(c)} />
                ))}
              </View>
            )}
          />
        </View>
        <View>
          <Label>Add members</Label>
          <MemberInviter value={invites} onChange={setInvites} />
          <Text variant="caption" tone="muted" className="mt-2">
            You can also share an invite link once the taab is created.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
