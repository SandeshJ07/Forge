import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, hydrate, type Query } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * A small on-device copy of the queries behind Home, Plan, Diet and Settings, so a
 * cold start (or a sleeping backend on Render's free plan) shows the last
 * known data at once while fresh data loads in the background. Queries past
 * the client's staleTime refetch on mount as usual; this only fills the gap.
 * Wiped as soon as the session ends (sign-out or expiry).
 */

// Bump when a cached response shape changes, so old copies are ignored.
const STORAGE_KEY = 'forge-query-cache-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 1000;

/** First element of the query keys worth keeping (all are scoped by userId in the key). */
const PERSISTED_QUERIES = new Set([
  // Home
  'stats',
  'workouts',
  'personal-records',
  // Plan
  'latest-plan',
  'pending-plan',
  // Diet (Plan tab switch, Home's "Today's meals", the diet form)
  'latest-diet-plan',
  'diet-access', // the diet screen waits on this before showing the plan
  'diet-preferences', // pre-fills the diet form
  // Settings / profile (also gates onboarding routing)
  'user-profile',
]);

interface StoredCache {
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

function shouldPersist(query: Query): boolean {
  return query.state.status === 'success' && PERSISTED_QUERIES.has(String(query.queryKey[0]));
}

/** Loads the saved copy into the query client. Call once, before screens mount. */
export async function restoreQueryCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as StoredCache;
    if (!stored?.state || Date.now() - stored.savedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    // Keeps each query's original fetch time, so stale data still refetches on mount.
    hydrate(queryClient, stored.state);
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
}

export async function clearPersistedQueryCache(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

let started = false;

/** Saves the persisted queries (debounced) whenever the cache changes, and wipes the copy when the session ends. */
export function startPersistingQueryCache(): void {
  if (started) return;
  started = true;

  let timer: ReturnType<typeof setTimeout> | null = null;
  queryClient.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!useAuthStore.getState().session) return;
      const stored: StoredCache = {
        savedAt: Date.now(),
        state: dehydrate(queryClient, { shouldDehydrateQuery: shouldPersist, shouldDehydrateMutation: () => false }),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {});
    }, SAVE_DELAY_MS);
  });

  useAuthStore.subscribe((state, previous) => {
    if (previous.session && !state.session) {
      if (timer) clearTimeout(timer);
      timer = null;
      clearPersistedQueryCache();
    }
  });
}
