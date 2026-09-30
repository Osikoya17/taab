import { useRouter, useScrollToTop } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';

import { GroupRow } from '@/components/groups/GroupRow';
import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormInput } from '@/components/ui/FormInput';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Screen } from '@/components/ui/Screen';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useGroups } from '@/features/groups/queries';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import type { GroupSummary } from '@/services/groups.service';

type Filter = 'all' | 'owe' | 'owed' | 'settled';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owe', label: 'You owe' },
  { value: 'owed', label: 'Owed to you' },
  { value: 'settled', label: 'Settled' },
];

function matches(summary: GroupSummary, filter: Filter, query: string) {
  const q = query.trim().toLowerCase();
  if (q && !summary.group.name.toLowerCase().includes(q) && !summary.group.members.some((m) => m.name.toLowerCase().includes(q))) return false;
  if (filter === 'owe') return summary.myBalance < 0;
  if (filter === 'owed') return summary.myBalance > 0;
  if (filter === 'settled') return summary.myBalance === 0;
  return true;
}

export default function GroupsScreen() {
  const router = useRouter();
  const groups = useGroups();
  const bottomInset = useBottomInset(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const listRef = useRef<FlatList<GroupSummary>>(null);
  useScrollToTop(listRef);

  const all = groups.data ?? [];
  const visible = all.filter((g) => matches(g, filter, query));

  function newGroup() {
    router.push('/group/new');
  }

  const listHeader =
    all.length > 0 ? (
      <View className="gap-3 pb-4">
        <FormInput label="Search taabs" hideLabel icon={Search} placeholder="Search taabs or people" value={query} onChangeText={setQuery} returnKeyType="search" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>
    ) : null;

  return (
    <Screen
      scroll={false}
      header={
        <>
          <AppHeader large title="Your taabs" right={<Button label="New taab" icon={Plus} size="md" fullWidth={false} onPress={newGroup} />} />
          <OfflineBanner />
        </>
      }>
      {groups.isPending ? (
        <View className="gap-3 px-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : groups.isError && !groups.data ? (
        <ErrorState title="Couldn’t load your taabs." onRetry={() => groups.refetch()} retrying={groups.isRefetching} />
      ) : (
        <FlatList
          ref={listRef}
          data={visible}
          keyExtractor={(item) => item.group.id}
          renderItem={({ item }) => <GroupRow summary={item} onPress={() => router.push(`/group/${item.group.id}`)} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            all.length === 0 ? (
              <EmptyState illustration="stack" title="No taabs yet." description="Your groups will appear here." actionLabel="Create a taab" onAction={newGroup} />
            ) : (
              <EmptyState compact illustration="stack" title="Nothing here" description={query ? `No taabs match “${query}”.` : 'No taabs match this filter.'} />
            )
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={groups.isRefetching} onRefresh={() => groups.refetch()} />}
        />
      )}
    </Screen>
  );
}
