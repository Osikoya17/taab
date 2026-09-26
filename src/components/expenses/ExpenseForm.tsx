import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

import { MoreOptions } from '@/components/expenses/MoreOptions';
import { ParticipantSelector } from '@/components/expenses/ParticipantSelector';
import { PayerPicker } from '@/components/expenses/PayerPicker';
import { SplitBreakdown } from '@/components/expenses/SplitBreakdown';
import { SheetHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { FormInput } from '@/components/ui/FormInput';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { FEATURES } from '@/features/billing/products';
import { useEntitlements } from '@/features/billing/use-entitlements';
import { guessCategory } from '@/features/expenses/categories';
import {
  buildExpenseInput,
  defaultFormValues,
  expenseFormSchema,
  formValuesFromExpense,
  previewSplit,
  type ExpenseFormValues,
} from '@/features/expenses/expense-form';
import { useSaveExpense } from '@/features/expenses/queries';
import { enablePushNotifications } from '@/features/notifications/push';
import { haptics } from '@/lib/haptics';
import { isServiceError } from '@/services/api/errors';
import type { GroupSummary } from '@/services/groups.service';
import { usePreferences } from '@/store/preferences.store';
import { toast } from '@/store/toast.store';
import type { Expense, SplitMethod } from '@/types/models';
import { formatMoney } from '@/utils/money';
import { useGoBack } from '@/hooks/use-go-back';

const SUGGESTIONS = ['Dinner', 'Uber', 'Rent', 'Groceries'];

export type ExpenseFormProps = {
  groups: GroupSummary[];
  initialGroupId?: string;
  expense?: Expense;
  /** Pre-selects Repeat, e.g. when coming from the recurring screen. */
  initialRepeat?: 'weekly' | 'monthly';
  meId: string;
};

export function ExpenseForm({ groups, initialGroupId, expense, initialRepeat, meId }: ExpenseFormProps) {
  const router = useRouter();
  const goBack = useGoBack();
  const { can } = useEntitlements();
  const save = useSaveExpense(expense?.id);
  const notificationPromptedAt = usePreferences((s) => s.notificationPromptedAt);
  const markNotificationPrompted = usePreferences((s) => s.markNotificationPrompted);

  const startGroup = groups.find((g) => g.group.id === (expense?.groupId ?? initialGroupId))?.group ?? groups[0]?.group;

  const { control, handleSubmit, setValue, setError, clearErrors, formState } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: expense
      ? formValuesFromExpense(expense)
      : { ...defaultFormValues(startGroup, meId), repeat: initialRepeat && can(FEATURES.recurringExpenses) ? initialRepeat : 'off' },
  });

  const values = useWatch({ control }) as ExpenseFormValues;
  const group = groups.find((g) => g.group.id === values.groupId)?.group ?? startGroup;
  const currency = group.currency;
  const nameOf = (id: string) => (id === meId ? 'You' : (group.members.find((m) => m.userId === id)?.name ?? 'Someone'));
  const participants = group.members.filter((m) => values.participantIds.includes(m.userId));
  const preview = previewSplit(values, currency, nameOf);
  const advancedUnlocked = can(FEATURES.advancedSplits);

  function switchGroup(groupId: string) {
    const next = groups.find((g) => g.group.id === groupId)?.group;
    if (!next || next.id === values.groupId) return;
    setValue('groupId', next.id);
    setValue('participantIds', next.members.map((m) => m.userId));
    setValue('payerIds', [meId]);
    setValue('payerMode', 'equal');
    setValue('payerAmounts', {});
    setValue('splitValues', {});
  }

  function changeMethod(method: SplitMethod) {
    if ((method === 'percentage' || method === 'shares') && !advancedUnlocked) {
      router.push({ pathname: '/subscription', params: { feature: FEATURES.advancedSplits } });
      return;
    }
    setValue('splitMethod', method);
    setValue('splitValues', {});
    clearErrors('root');
  }

  const onSubmit = handleSubmit(async (formValues) => {
    const built = buildExpenseInput(formValues, currency, nameOf);
    if (!built.ok) {
      setError('root', { message: built.message });
      haptics.warning();
      return;
    }
    try {
      await save.mutateAsync({ input: built.input, repeat: built.recurring });
      haptics.success();
      toast.success(expense ? 'Expense updated' : 'Expense added', `${built.input.title} • ${formatMoney(built.input.amount, currency)}`);
      goBack();
      // Ask for push permission in context — once, after the first saved expense.
      if (!notificationPromptedAt) {
        markNotificationPrompted();
        enablePushNotifications().catch(() => undefined);
      }
    } catch (error) {
      const message =
        isServiceError(error) && error.code === 'forbidden'
          ? 'That split method needs taab+.'
          : 'We couldn’t save that. Check your connection and try again.';
      setError('root', { message });
    }
  });

  const saving = save.isPending || formState.isSubmitting;
  const canSave = values.amount > 0 && values.title.trim().length > 0 && preview.ok;
  const submitError = formState.errors.root?.message ?? Object.values(formState.errors).find((error) => error?.message)?.message;

  return (
    <Screen
      keyboard
      safeTop={false}
      header={
        <SheetHeader
          title={expense ? 'Edit expense' : 'Add expense'}
          onCancel={() => goBack()}
          actionLabel="Save"
          onAction={onSubmit}
          actionDisabled={!canSave || saving}
        />
      }
      footer={
        <View className="gap-2">
          {submitError ? (
            <Text variant="caption" tone="negative" className="text-center" accessibilityLiveRegion="polite">
              {typeof submitError === 'string' ? submitError : 'Check the form and try again.'}
            </Text>
          ) : null}
          <Button label={expense ? 'Save changes' : 'Add expense'} onPress={onSubmit} loading={saving} disabled={!canSave} />
        </View>
      }>
      {!expense && groups.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-1" contentContainerClassName="gap-2 px-5">
          {groups.map(({ group: g }) => (
            <Chip key={g.id} label={g.name} selected={g.id === values.groupId} onPress={() => switchGroup(g.id)} />
          ))}
        </ScrollView>
      ) : (
        <Text variant="label" tone="muted" className="mt-1 text-center">
          {group.name}
        </Text>
      )}

      <View className="mt-6">
        <Controller
          control={control}
          name="amount"
          render={({ field }) => <CurrencyInput value={field.value} onChange={field.onChange} currency={currency} autoFocus={!expense} />}
        />
      </View>

      <View className="mt-6 gap-3">
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <FormInput
              label="Description"
              hideLabel
              placeholder="What's this for?"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={() => {
                field.onBlur();
                if (!values.category) setValue('category', guessCategory(field.value));
              }}
              error={fieldState.error?.message}
              returnKeyType="done"
              maxLength={80}
              autoCapitalize="sentences"
            />
          )}
        />
        {values.title.length === 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                label={s}
                onPress={() => {
                  setValue('title', s, { shouldValidate: true });
                  setValue('category', guessCategory(s));
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View className="mt-6">
        <PayerPicker
          members={group.members}
          meId={meId}
          currency={currency}
          payerIds={values.payerIds}
          payerMode={values.payerMode}
          payerAmounts={values.payerAmounts}
          onChange={(next) => {
            setValue('payerIds', next.payerIds);
            setValue('payerMode', next.payerMode);
            setValue('payerAmounts', next.payerAmounts);
            clearErrors('root');
          }}
        />
      </View>

      <View className="mt-6">
        <ParticipantSelector
          members={group.members}
          selectedIds={values.participantIds}
          meId={meId}
          onChange={(ids) => {
            setValue('participantIds', ids);
            clearErrors('root');
          }}
        />
      </View>

      <View className="mt-5">
        <SplitBreakdown
          method={values.splitMethod}
          onMethodChange={changeMethod}
          participants={participants}
          values={values.splitValues}
          onValueChange={(userId, text) => setValue('splitValues', { ...values.splitValues, [userId]: text })}
          preview={preview}
          currency={currency}
          meId={meId}
          advancedUnlocked={advancedUnlocked}
        />
      </View>

      <View className="mt-4">
        <MoreOptions
          value={values}
          defaultOpen={!!expense?.notes || !!expense?.receiptUrl || !!initialRepeat}
          allowRepeat={!expense}
          recurringUnlocked={can(FEATURES.recurringExpenses)}
          onRecurringLocked={() => router.push({ pathname: '/subscription', params: { feature: FEATURES.recurringExpenses } })}
          onChange={(patch) => {
            for (const [key, v] of Object.entries(patch)) setValue(key as keyof ExpenseFormValues, v as never);
          }}
        />
      </View>
    </Screen>
  );
}
