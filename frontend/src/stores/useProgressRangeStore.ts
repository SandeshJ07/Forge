import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** How many days back the Progress chart looks; null = all entries. */
export type ProgressRangeDays = number | null;

export const DEFAULT_RANGE_DAYS = 15;
export const MAX_RANGE_DAYS = 3650;

export const PROGRESS_RANGE_PRESETS: { days: ProgressRangeDays; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 15, label: '15 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 365, label: '1 year' },
  { days: null, label: 'All time' },
];

/** "Last 15 days", "Last 3 months", "Last 45 days", "All time". */
export function rangeLabel(days: ProgressRangeDays): string {
  if (days == null) return 'All time';
  const preset = PROGRESS_RANGE_PRESETS.find((p) => p.days === days);
  return `Last ${preset ? preset.label : `${days} day${days === 1 ? '' : 's'}`}`;
}

interface ProgressRangeState {
  days: ProgressRangeDays;
  setDays: (days: ProgressRangeDays) => void;
}

/** The chart range the user last picked (a preset or any number of days), remembered on this device. */
export const useProgressRangeStore = create<ProgressRangeState>()(
  persist(
    (set) => ({
      days: DEFAULT_RANGE_DAYS,
      setDays: (days) =>
        set({ days: days == null ? null : Math.min(MAX_RANGE_DAYS, Math.max(1, Math.round(days))) }),
    }),
    { name: 'forge-progress-range', storage: createJSONStorage(() => AsyncStorage) }
  )
);
