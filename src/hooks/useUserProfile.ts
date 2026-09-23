import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { completeOnboarding, fetchUserProfile, upsertUserProfile } from '@/api/profile';
import type { UserProfile } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUnitStore } from '@/stores/useUnitStore';

export function useUserProfile() {
  const userId = useAuthStore((s) => s.session?.userId);
  const setUnitSystem = useUnitStore((s) => s.setUnitSystem);

  const query = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: fetchUserProfile,
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (query.data?.unit_system) setUnitSystem(query.data.unit_system);
  }, [query.data?.unit_system, setUnitSystem]);

  return query;
}

export function useUpsertUserProfile() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: Partial<Omit<UserProfile, 'user_id' | 'anthropic_api_key_set'>>) =>
      upsertUserProfile(fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    },
  });
}

export function useCompleteOnboarding() {
  const userId = useAuthStore((s) => s.session?.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    },
  });
}
