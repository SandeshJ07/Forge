import type { Slug } from 'react-native-body-highlighter';

/**
 * Exercise-library muscle names (free-exercise-db) → body-map regions.
 * The map has no separate lats / middle back / abductor regions, so those
 * light up the nearest one.
 */
const MUSCLE_TO_SLUGS: Record<string, Slug[]> = {
  abdominals: ['abs', 'obliques'],
  abductors: ['gluteal'],
  adductors: ['adductors'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  shoulders: ['deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
};

/** Fill per body-map region: primary muscles in primaryColor, secondary ones in secondaryColor (a primary always wins). */
export function muscleFills(
  primary: string[],
  secondary: string[],
  primaryColor: string,
  secondaryColor: string
): Partial<Record<Slug, string>> {
  const fills: Partial<Record<Slug, string>> = {};
  for (const muscle of secondary) {
    for (const slug of MUSCLE_TO_SLUGS[muscle.toLowerCase()] ?? []) fills[slug] = secondaryColor;
  }
  for (const muscle of primary) {
    for (const slug of MUSCLE_TO_SLUGS[muscle.toLowerCase()] ?? []) fills[slug] = primaryColor;
  }
  return fills;
}
