import type { PlanRefreshCadence } from '@/types/database';

const MONTHLY_DAYS = 30;
export const MIN_REFRESH_DAYS = 1;
/** Mirrors the backend's check on plan_refresh_days. */
export const MAX_REFRESH_DAYS = 365;

/** Days between reminders: 30 for monthly, the user's own number for custom. */
export function refreshIntervalDays(cadence: PlanRefreshCadence, customDays: number | null | undefined): number {
  return cadence === 'custom' && customDays ? customDays : MONTHLY_DAYS;
}

/** "a month", "10 days", "a day" — for "It's been … since these were made". */
export function refreshPeriodText(cadence: PlanRefreshCadence, customDays: number | null | undefined): string {
  if (cadence !== 'custom' || !customDays) return 'a month';
  return customDays === 1 ? 'a day' : `${customDays} days`;
}

/**
 * Reminder only, never automatic — generate-plan has a real per-call cost,
 * so refreshing on a cadence still requires an explicit tap. This just tells
 * the UI when to surface that nudge, based on the last plan's created_at.
 */
export function isPlanRefreshDue(lastPlanCreatedAt: string | null | undefined, intervalDays: number): boolean {
  if (!lastPlanCreatedAt) return false;
  return Date.now() - new Date(lastPlanCreatedAt).getTime() >= intervalDays * 24 * 60 * 60 * 1000;
}

export function daysUntilPlanRefresh(lastPlanCreatedAt: string | null | undefined, intervalDays: number): number | null {
  if (!lastPlanCreatedAt) return null;
  const dueAtMs = new Date(lastPlanCreatedAt).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  return Math.ceil((dueAtMs - Date.now()) / (24 * 60 * 60 * 1000));
}
