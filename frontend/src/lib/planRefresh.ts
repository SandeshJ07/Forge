import type { PlanRefreshCadence } from '@/types/database';

const CADENCE_DAYS: Record<PlanRefreshCadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

/**
 * Reminder only, never automatic — generate-plan has a real per-call cost,
 * so refreshing on a cadence still requires an explicit tap. This just tells
 * the UI when to surface that nudge, based on the last plan's created_at.
 */
export function isPlanRefreshDue(
  lastPlanCreatedAt: string | null | undefined,
  cadence: PlanRefreshCadence
): boolean {
  if (!lastPlanCreatedAt) return false;
  const dueAfterMs = CADENCE_DAYS[cadence] * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastPlanCreatedAt).getTime() >= dueAfterMs;
}

export function daysUntilPlanRefresh(
  lastPlanCreatedAt: string | null | undefined,
  cadence: PlanRefreshCadence
): number | null {
  if (!lastPlanCreatedAt) return null;
  const dueAtMs = new Date(lastPlanCreatedAt).getTime() + CADENCE_DAYS[cadence] * 24 * 60 * 60 * 1000;
  return Math.ceil((dueAtMs - Date.now()) / (24 * 60 * 60 * 1000));
}
