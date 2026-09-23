import { useQuery } from '@tanstack/react-query';
import { fetchPersonalRecords } from '@/api/personalRecords';
import { useAuthStore } from '@/stores/useAuthStore';

export function usePersonalRecords() {
  const userId = useAuthStore((s) => s.session?.userId);
  return useQuery({
    queryKey: ['personal-records', userId],
    queryFn: fetchPersonalRecords,
    enabled: Boolean(userId),
  });
}
