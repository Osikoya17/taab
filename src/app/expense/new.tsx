import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { SheetHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { useAuthSession } from '@/features/auth/auth-context';
import { useGroups } from '@/features/groups/queries';
import { useGoBack } from '@/hooks/use-go-back';

export default function NewExpenseScreen() {
  const { groupId, repeat } = useLocalSearchParams<{ groupId?: string; repeat?: 'weekly' | 'monthly' }>();
  const router = useRouter();
  const goBack = useGoBack();
  const { user } = useAuthSession();
  const groups = useGroups();

  if (!groups.data) {
    return (
      <Screen safeTop={false} header={<SheetHeader title="Add expense" onCancel={() => goBack()} />}>
        {groups.isError ? (
          <ErrorState title="Couldn’t load your taabs." onRetry={() => groups.refetch()} />
        ) : (
          <View className="pt-6">
            <LoadingSkeleton rows={3} />
          </View>
        )}
      </Screen>
    );
  }

  if (groups.data.length === 0) {
    return (
      <Screen safeTop={false} header={<SheetHeader title="Add expense" onCancel={() => goBack()} />}>
        <EmptyState
          illustration="stack"
          title="Start with a taab"
          description="Expenses live inside a taab — create one for the people you’re splitting with."
          actionLabel="Create a taab"
          onAction={() => router.replace('/group/new')}
        />
      </Screen>
    );
  }

  return <ExpenseForm groups={groups.data} initialGroupId={groupId} initialRepeat={repeat} meId={user?.id ?? ''} />;
}
