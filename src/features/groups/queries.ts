import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { groupsService, type CreateGroupInput, type Invite } from '@/services/groups.service';

export function useGroups() {
  return useQuery({ queryKey: queryKeys.groups, queryFn: groupsService.listGroups });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.group(groupId ?? ''),
    queryFn: () => groupsService.getGroup(groupId!),
    enabled: !!groupId,
  });
}

export function usePeopleSearch(query: string) {
  return useQuery({ queryKey: queryKeys.people(query), queryFn: () => groupsService.searchPeople(query), staleTime: 60_000 });
}

export function useCreateGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => groupsService.createGroup(input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.groups });
      client.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useInviteMembers(groupId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (invites: Invite[]) => groupsService.inviteMembers(groupId, invites),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      client.invalidateQueries({ queryKey: queryKeys.groups });
      client.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useLeaveGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsService.leaveGroup(groupId),
    onSuccess: (_result, groupId) => {
      client.removeQueries({ queryKey: queryKeys.group(groupId) });
      client.removeQueries({ queryKey: ['expense'] });
      return client.invalidateQueries();
    },
  });
}
