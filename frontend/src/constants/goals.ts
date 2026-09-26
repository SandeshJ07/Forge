import type { Goal } from '@/types/database';

/** Users pick up to this many goals; the first one picked is the primary. Mirrors backend MAX_GOALS. */
export const MAX_GOALS = 2;

export const GOAL_OPTIONS: { value: Goal; label: string; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Lift heavier — lower reps, longer rest' },
  { value: 'hypertrophy', label: 'Build muscle', description: 'Size and shape — moderate reps, more volume' },
  { value: 'general_fitness', label: 'General fitness', description: 'Feel fitter and move better day to day' },
  { value: 'endurance', label: 'Endurance', description: 'Go longer and recover faster' },
  { value: 'weight_loss', label: 'Weight loss', description: 'Burn fat, keep muscle — strength plus cardio' },
];

/** Tapping a picked goal removes it; tapping another adds it, unless MAX_GOALS are already picked. */
export function toggleGoal(goals: Goal[], goal: Goal): Goal[] {
  if (goals.includes(goal)) return goals.filter((g) => g !== goal);
  return goals.length < MAX_GOALS ? [...goals, goal] : goals;
}
