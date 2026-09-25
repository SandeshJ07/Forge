import type { PlanGroup, PlanPayload, Weekday } from '@/types/database';

export const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};
const JS_DAY_TO_WEEKDAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const LEGACY_LABEL = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*[-–—:]?\s*/i;

/**
 * A plan's exercise groups. Plans generated before groups stored one entry
 * per day ("Monday - Push"); those read as a group named "Push" mapped to Monday.
 */
export function planGroups(plan: PlanPayload | null | undefined): PlanGroup[] {
  if (!plan) return [];
  if (plan.groups) return plan.groups;
  return (plan.days ?? []).map((day) => {
    const match = LEGACY_LABEL.exec(day.day_label.trim());
    const weekday = match ? (match[1].toLowerCase() as Weekday) : null;
    const name = match ? day.day_label.trim().slice(match[0].length) : day.day_label;
    return {
      name: name || day.focus || day.day_label,
      focus: day.focus,
      weekdays: weekday ? [weekday] : [],
      warmup: day.warmup ?? [],
      exercises: day.exercises,
    };
  });
}

export function todayWeekday(): Weekday {
  return JS_DAY_TO_WEEKDAY[new Date().getDay()];
}

/** "Mon · Thu", or null for a group not tied to any day. */
export function formatWeekdays(weekdays: Weekday[] | undefined): string | null {
  return weekdays?.length ? weekdays.map((d) => WEEKDAY_SHORT[d]).join(' · ') : null;
}
