import { apiClient } from '@/lib/apiClient';

export interface PeriodStats {
  workouts: number;
  volume_kg: number;
  records: number;
}

export interface StrengthGain {
  exercise_id: string;
  exercise_name: string;
  first_best_kg: number;
  current_best_kg: number;
  gain_kg: number;
  gain_pct: number;
}

export interface StatsOverview {
  first_workout_at: string | null;
  total_workouts: number;
  total_sets: number;
  total_reps: number;
  total_volume_kg: number;
  this_month: PeriodStats;
  last_month: PeriodStats;
  strength_gains: StrengthGain[];
  next_milestone: { target: number; remaining: number; previous: number } | null;
}

/** Months are computed in the device's timezone so "this month" matches the user's calendar. */
export async function fetchStatsOverview(): Promise<StatsOverview> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return apiClient.get<StatsOverview>(`/stats/overview?tz=${encodeURIComponent(tz)}`);
}
