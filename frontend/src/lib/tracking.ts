import type { TrackingType, UnitSystem } from '@/types/database';

/**
 * How each exercise type is logged (modelled on Hevy's exercise types).
 * Keep TrackingType in sync with backend/app/services/exercise_catalog.py.
 */
export interface TrackingFields {
  weight: boolean;
  reps: boolean;
  distance: boolean;
  time: boolean;
  /** weighted_bodyweight: the weight column is optional extra load ("+kg"). */
  addedWeight: boolean;
}

export const TRACKING_FIELDS: Record<TrackingType, TrackingFields> = {
  weight_reps: { weight: true, reps: true, distance: false, time: false, addedWeight: false },
  bodyweight_reps: { weight: false, reps: true, distance: false, time: false, addedWeight: false },
  weighted_bodyweight: { weight: true, reps: true, distance: false, time: false, addedWeight: true },
  duration: { weight: false, reps: false, distance: false, time: true, addedWeight: false },
  distance_duration: { weight: false, reps: false, distance: true, time: true, addedWeight: false },
  weight_distance: { weight: true, reps: false, distance: true, time: false, addedWeight: false },
};

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Weight & reps',
  bodyweight_reps: 'Bodyweight reps',
  weighted_bodyweight: 'Reps (+ optional weight)',
  duration: 'Time',
  distance_duration: 'Distance & time',
  weight_distance: 'Weight & distance',
};

const TRACKING_VALUES = new Set<string>(Object.keys(TRACKING_FIELDS));

export function isTrackingType(value: unknown): value is TrackingType {
  return typeof value === 'string' && TRACKING_VALUES.has(value);
}

const DISTANCE_CARDIO = /treadmill|running|\brun\b|jog|walk|hik|cycl|bike|bicycl|rowing|\browe?r\b|elliptical|swim|skat|sprint/i;
const TIMED = /plank|\bhold\b|dead hang|wall sit|jump rope|rope jump|skipping|stretch|battle rope|battling rope|stair|step mill|isometric/i;
const CARRY = /carry|farmer|sled|yoke|prowler|drag/i;
const WEIGHTED_BW = /pull-?ups?\b|chin-?ups?\b|\bdips?\b/i;
const BODYWEIGHT = /push-?ups?\b|burpee|crunch|sit-?ups?\b|air squat|jumping jack|mountain climber|leg raise|bicycle crunch|lunge$|box jump|jump squat/i;

/**
 * Best guess from the name alone — for plan exercises generated before
 * tracking types existed, or that don't match a glossary exercise.
 */
export function inferTracking(name: string): TrackingType {
  if (CARRY.test(name)) return 'weight_distance';
  if (TIMED.test(name)) return 'duration';
  if (DISTANCE_CARDIO.test(name) && !/row \(|bent over row|upright row|seated row/i.test(name)) return 'distance_duration';
  if (/assist/i.test(name) && WEIGHTED_BW.test(name)) return 'bodyweight_reps';
  if (WEIGHTED_BW.test(name)) return 'weighted_bodyweight';
  if (BODYWEIGHT.test(name) && !/\((barbell|dumbbell|cable|machine|kettlebell)\)/i.test(name)) return 'bodyweight_reps';
  return 'weight_reps';
}

export function resolveTracking(tracking: unknown, name: string): TrackingType {
  return isTrackingType(tracking) ? tracking : inferTracking(name);
}

/** Cardio distances in km / mi; carries and sled work in m / yd. */
export function distanceUnit(tracking: TrackingType, unitSystem: UnitSystem): string {
  if (tracking === 'weight_distance') return unitSystem === 'imperial' ? 'yd' : 'm';
  return unitSystem === 'imperial' ? 'mi' : 'km';
}

const METERS_PER: Record<string, number> = { km: 1000, mi: 1609.344, m: 1, yd: 0.9144 };

export function toMeters(value: number, unit: string): number {
  return value * (METERS_PER[unit] ?? 1);
}

/**
 * "12:30" → 750, "1:02:00" → 3720. A bare number is minutes for cardio
 * (distance & time) and seconds for holds (plank), matching how each is usually thought of.
 */
export function parseDuration(text: string, tracking: TrackingType): number | null {
  const value = text.trim().replace(',', '.');
  if (!value) return null;
  if (value.includes(':')) {
    const parts = value.split(':').map(Number);
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    return Math.round(parts.reduce((total, n) => total * 60 + n, 0));
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(tracking === 'distance_duration' ? n * 60 : n);
}

/** 750 → "12:30", 3720 → "1:02:00". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A plan target like "45 s", "20 min", "1.5 h" → "0:45", "20:00", "1:30:00"; "" when it isn't a time. */
export function targetToTime(target: string): string {
  // A bare "m" is metres, not minutes.
  const match = /(\d+(?:[.,]\d+)?)\s*(h|hr|hours?|min|mins|minutes?|s|sec|secs|seconds?)\b/i.exec(target);
  if (!match) return '';
  const n = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  const seconds = unit.startsWith('h') ? n * 3600 : unit.startsWith('m') ? n * 60 : n;
  return formatDuration(seconds);
}

/** A plan target like "3 km" or "400 m" → the number in `unit`, as text; "" when it isn't a distance. */
export function targetToDistance(target: string, unit: string): string {
  const match = /(\d+(?:[.,]\d+)?)\s*(km|mi|miles?|m|meters?|metres?|yd|yards?)\b/i.exec(target);
  if (!match) return '';
  const raw = match[2].toLowerCase();
  const from = raw.startsWith('k') ? 'km' : raw.startsWith('mi') ? 'mi' : raw.startsWith('y') ? 'yd' : 'm';
  const meters = toMeters(Number(match[1].replace(',', '.')), from);
  const value = meters / (METERS_PER[unit] ?? 1);
  return String(Math.round(value * 100) / 100);
}

/** The first number in a rep target: "8-10" → "8", "AMRAP" → "". */
export function targetToReps(target: string): string {
  if (/\d\s*(h|min|s|sec|km|mi|m|yd)\b/i.test(target)) return '';
  return /\d+/.exec(target)?.[0] ?? '';
}
