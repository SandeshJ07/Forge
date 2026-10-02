import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** How far back the Progress chart looks; null = all entries. */
export type ProgressRangeDays = 15 | 30 | 90 | 365 | null;

export const PROGRESS_RANGES: { days: ProgressRangeDays; label: string }[] = [
  { days: 15, label: '15 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 365, label: '1 year' },
  { days: null, label: 'All' },
];

interface ProgressRangeState {
  days: ProgressRangeDays;
  setDays: (days: ProgressRangeDays) => void;
}

/** The chart range the user last picked, remembered on this device; 15 days until they change it. */
export const useProgressRangeStore = create<ProgressRangeState>()(
  persist(
    (set) => ({
      days: 15,
      setDays: (days) => set({ days }),
    }),
    { name: 'forge-progress-range', storage: createJSONStorage(() => AsyncStorage) }
  )
);
