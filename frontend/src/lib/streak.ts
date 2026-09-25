const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the given date. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local midnight of the Monday starting the date's week. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

export function dayKey(date: Date): string {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export interface StreakSummary {
  /** Consecutive weeks (Mon–Sun) with at least one workout, ending this week or last. */
  currentWeeks: number;
  bestWeeks: number;
  /** Whether this week already has a workout (the streak is safe until next Monday). */
  thisWeekDone: boolean;
  /** Workouts per local day, keyed by dayKey(). */
  countsByDay: Map<string, number>;
}

/**
 * Weekly streaks rather than daily ones: lifters rarely train every day, so
 * "at least once a week" is the habit worth rewarding. The current week never
 * breaks a streak while it's still in progress.
 */
export function summarizeStreak(workoutDates: string[], now: Date = new Date()): StreakSummary {
  const countsByDay = new Map<string, number>();
  const weekStarts = new Set<number>();
  for (const iso of workoutDates) {
    const date = new Date(iso);
    const key = dayKey(date);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    weekStarts.add(startOfWeek(date).getTime());
  }

  const thisWeek = startOfWeek(now);
  const thisWeekDone = weekStarts.has(thisWeek.getTime());

  let currentWeeks = 0;
  let cursor = thisWeekDone ? thisWeek : addDays(thisWeek, -7);
  while (weekStarts.has(cursor.getTime())) {
    currentWeeks += 1;
    cursor = addDays(cursor, -7);
  }

  let bestWeeks = 0;
  let run = 0;
  let previous: number | null = null;
  for (const week of [...weekStarts].sort((a, b) => a - b)) {
    // Compare by calendar days, not raw ms, so DST shifts don't break a run.
    const gapDays = previous === null ? null : Math.round((week - previous) / DAY_MS);
    run = gapDays === 7 ? run + 1 : 1;
    bestWeeks = Math.max(bestWeeks, run);
    previous = week;
  }

  return { currentWeeks, bestWeeks: Math.max(bestWeeks, currentWeeks), thisWeekDone, countsByDay };
}

/** Columns of 7 days (Mon→Sun), oldest week first, ending with the current week. */
export function buildCalendarWeeks(weeks: number, now: Date = new Date()): Date[][] {
  const firstWeek = addDays(startOfWeek(now), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstWeek, w * 7 + d))
  );
}
