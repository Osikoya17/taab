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
import { useScan } from '@/features/packs/queries';
import { useGoBack } from '@/hooks/use-go-back';

export default function NewExpenseScreen() {
  const { groupId, repeat, scanId } = useLocalSearchParams<{ groupId?: string; repeat?: 'weekly' | 'monthly'; scanId?: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const { user } = useAuthSession();
  const groups = useGroups();
  const scan = useScan(scanId);

  if (!groups.data || (scanId && scan.isPending)) {
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

  // A scan that isn't finished, or isn't yours, just opens a blank form.
  const reviewed = scan.data?.status === 'drafted' ? scan.data : undefined;
  return <ExpenseForm groups={groups.data} initialGroupId={reviewed?.groupId ?? groupId} initialRepeat={repeat} scan={reviewed} meId={user?.id ?? ''} />;
}
