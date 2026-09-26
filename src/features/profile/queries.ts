import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/features/auth/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { usersService, type ProfilePatch, type SetupInput } from '@/services/users.service';

export function useProfile() {
  const { isSignedIn } = useAuthSession();
  return useQuery({ queryKey: queryKeys.profile, queryFn: usersService.getProfile, enabled: isSignedIn });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => usersService.updateProfile(patch),
    onSuccess: (profile) => {
      client.setQueryData(queryKeys.profile, profile);
      // Names are shown on group members and activity.
      client.invalidateQueries({ queryKey: queryKeys.groups });
      client.invalidateQueries({ queryKey: ['group'] });
    },
  });
}

export function useCompleteSetup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SetupInput) => usersService.completeSetup(input),
    onSuccess: (profile) => {
      client.setQueryData(queryKeys.profile, profile);
      client.invalidateQueries();
    },
  });
}
