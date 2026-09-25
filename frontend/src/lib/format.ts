import type { UnitSystem } from '@/types/database';

export const LB_PER_KG = 2.20462;

/** Weights are stored in kg; show them in whichever unit the user picked. */
export function formatWeight(kg: number, unitSystem: UnitSystem): string {
  const value = unitSystem === 'imperial' ? kg * LB_PER_KG : kg;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${unitSystem === 'imperial' ? 'lb' : 'kg'}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBeforeToday(date: Date): number {
  return Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
}

function toDate(input: string | Date): Date {
  return typeof input === 'string' ? new Date(input) : input;
}

/** "Today", "Yesterday", "Mon, Sep 21" — or "Sep 21, 2025" outside the current year. */
export function formatDay(input: string | Date): string {
  const date = toDate(input);
  const diff = daysBeforeToday(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (date.getFullYear() !== new Date().getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Today · 8:57 PM" */
export function formatDayTime(input: string | Date): string {
  const date = toDate(input);
  return `${formatDay(date)} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** "Today" / "1d ago" / "3d ago" — compact enough for narrow stat tiles. */
export function formatDaysAgo(input: string | Date): string {
  const diff = daysBeforeToday(toDate(input));
  if (diff <= 0) return 'Today';
  return `${diff}d ago`;
}

/** "general_fitness" -> "General fitness" */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
