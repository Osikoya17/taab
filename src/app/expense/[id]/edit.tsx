import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { SheetHeader } from '@/components/ui/AppHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { useAuthSession } from '@/features/auth/auth-context';
import { useExpense } from '@/features/expenses/queries';
import { useGroups } from '@/features/groups/queries';
import { useGoBack } from '@/hooks/use-go-back';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
  const { user } = useAuthSession();
  const expense = useExpense(id);
  const groups = useGroups();

  if (!expense.data || !groups.data) {
    return (
      <Screen safeTop={false} header={<SheetHeader title="Edit expense" onCancel={() => goBack(`/expense/${id}`)} />}>
        {expense.isError || groups.isError ? (
          <ErrorState title="Couldn’t load this expense." onRetry={() => expense.refetch()} />
        ) : (
          <View className="pt-6">
            <LoadingSkeleton rows={3} />
          </View>
        )}
      </Screen>
    );
  }

  return <ExpenseForm groups={groups.data} expense={expense.data.expense} meId={user?.id ?? ''} />;
}
