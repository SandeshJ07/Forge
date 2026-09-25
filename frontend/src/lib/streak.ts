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

/**
 * The month containing `now` as calendar rows of 7 (Mon→Sun). Slots before
 * the 1st and after the last day are null so every row lines up.
 */
export function buildMonthWeeks(now: Date = new Date()): (Date | null)[][] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const slots: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(now.getFullYear(), now.getMonth(), i + 1)),
  ];
  while (slots.length % 7) slots.push(null);
  return Array.from({ length: slots.length / 7 }, (_, w) => slots.slice(w * 7, w * 7 + 7));
}
