// Hand-written types mirroring the backend's SQLAlchemy models (see backend/app/models/).
// Regenerate/adjust manually if the schema changes.

export type WorkoutSourceType = 'manual';
export type ExerciseFeedbackRating = 'like' | 'dislike' | 'neutral';
export type Goal = 'strength' | 'hypertrophy' | 'general_fitness' | 'endurance' | 'weight_loss';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type UnitSystem = 'metric' | 'imperial';
export type AIProvider = 'anthropic' | 'gemini';
export type IntegrationProvider = AIProvider;
/** How an exercise is logged — see backend/app/services/exercise_catalog.py. */
export type TrackingType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'duration'
  | 'distance_duration'
  | 'weight_distance';
/** "monthly" = every 30 days; "custom" = every plan_refresh_days days. */
export type PlanRefreshCadence = 'monthly' | 'custom';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type MeasurementType =
  | 'body_weight'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'left_arm'
  | 'right_arm'
  | 'left_thigh'
  | 'right_thigh'
  | 'neck'
  | 'body_fat_pct'
  | string; // user-configurable, so allow arbitrary keys beyond the presets

export interface Exercise {
  id: string;
  name: string;
  aliases: string[] | null;
  muscle_groups: string[];
  secondary_muscle_groups: string[] | null;
  equipment: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  instructions: string[];
  /** First how-to image (list thumbnails). */
  media_url: string | null;
  /** Every how-to image in order — for free-exercise-db, the start and end position. */
  media_urls: string[];
  media_type: 'image' | 'gif' | null;
  category: string | null;
  source: string;
  tracking_type: TrackingType;
  created_at: string;
}

export interface UserExerciseFeedback {
  user_id: string;
  exercise_id: string;
  rating: ExerciseFeedbackRating;
  updated_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  source: WorkoutSourceType;
  external_id: string | null;
  title: string | null;
  date: string;
  duration_seconds: number | null;
  raw_payload: Record<string, unknown> | null;
  summary: string | null;
  perceived_exertion: number | null;
  felt_rating: 'too_easy' | 'just_right' | 'too_hard' | null;
  enjoyed: boolean | null;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  exercise_name_raw: string | null;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rpe: number | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface Measurement {
  id: string;
  user_id: string;
  type: MeasurementType;
  value: number;
  unit: string;
  date: string;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  user_id: string;
  storage_path: string;
  date: string;
  notes: string | null;
  created_at: string;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** Individual muscles only — the user builds each day themselves; nothing is pre-grouped. */
export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'lower_back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'cardio';

/** Per-plan choices from the Plan preferences screen; every field optional (the AI decides). */
export interface PlanPreferences {
  training_days?: Weekday[];
  /** Muscles per day, any number; days left out are the AI's call. */
  day_focus?: Partial<Record<Weekday, Muscle[]>>;
  include_warmup?: boolean;
  /** Individual equipment keys (src/constants/equipmentCatalog.ts); omitted = not specified. */
  equipment?: string[];
  session_minutes?: 30 | 45 | 60 | 90;
  notes?: string;
}

export interface GeneratedPlan {
  id: string;
  user_id: string;
  created_at: string;
  plan: PlanPayload;
  source_summary: Record<string, unknown>;
  /** True for the current plan (only one at a time). New plans wait for the user to accept them. */
  accepted: boolean;
  accepted_at: string | null;
  /** A new plan the user chose not to use; still in history. */
  dismissed: boolean;
  status: 'generating' | 'ready' | 'failed';
  error: string | null;
}

/** GET /plans/generation — the user's most recent background generation. */
export interface PlanGenerationStatus {
  status: 'idle' | 'generating' | 'ready' | 'failed';
  plan_id: string | null;
  error: string | null;
  started_at: string | null;
}

/** Today's plan generations on the app's shared AI key (GET /plans/usage). */
export interface PlanUsage {
  /** The user has their own key for their provider — no limit. */
  own_key: boolean;
  provider: AIProvider;
  /** null when own_key. */
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Next local midnight (ISO), when the count starts over. */
  resets_at: string;
}

export interface IntegrationToken {
  user_id: string;
  provider: IntegrationProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  /** Up to two, most important first. */
  goals: Goal[];
  experience_level: ExperienceLevel | null;
  equipment_access: string[] | null;
  unit_system: UnitSystem;
  ai_provider: AIProvider;
  anthropic_api_key_set: boolean;
  gemini_api_key_set: boolean;
  include_warmup: boolean;
  plan_refresh_cadence: PlanRefreshCadence;
  /** Days between reminders when the cadence is "custom" (1-365). */
  plan_refresh_days: number | null;
  gender: Gender | null;
  birth_year: number | null;
  height_cm: number | null;
  onboarded_at: string | null;
  /** False for accounts created with Google that never set a password. */
  has_password: boolean;
  /** Last Plan preferences submitted (saved on "Create my plan", even if generation failed). */
  plan_preferences: PlanPreferences | null;
}

export interface PersonalRecord {
  user_id: string;
  exercise_id: string;
  best_weight_kg: number;
  best_weight_reps: number | null;
  achieved_at: string;
  workout_id: string | null;
  updated_at: string;
}

// --- AI plan generation shape ---

export interface PlanExercise {
  exercise_id: string | null;
  exercise_name: string;
  sets: number;
  /** Target: reps ("8-10", "AMRAP"), a time ("45 s", "20 min") or a distance ("3 km"). */
  reps: string;
  rest_seconds: number;
  /** From the glossary when matched, else the AI's call; missing on older plans. */
  tracking?: TrackingType | null;
  /** e.g. "RIR 2", "~60 kg", "zone 2". */
  intensity?: string;
  /** Key setup and form cues. */
  how_to?: string;
  notes?: string;
}

export interface WarmupExercise {
  exercise_id?: string | null;
  exercise_name: string;
  duration_or_reps: string; // e.g. "5 min" or "2x15"
  tracking?: TrackingType | null;
  how_to?: string;
  notes?: string;
}

/** One workout's worth of exercises, loaded as a unit on the Log workout screen. */
export interface PlanGroup {
  name: string; // e.g. "Push" or "Upper A"
  focus: string; // e.g. "Chest, Shoulders, Triceps"
  /** Weekdays this group is mapped to; each weekday belongs to at most one group. */
  weekdays: Weekday[];
  estimated_minutes?: number;
  warmup: WarmupExercise[];
  exercises: PlanExercise[];
}

/** Plans generated before exercise groups: one entry per training day. Read via planGroups(). */
export interface LegacyPlanDay {
  day_label: string; // e.g. "Monday - Push"
  focus: string;
  warmup: WarmupExercise[];
  exercises: PlanExercise[];
}

export interface PlanPayload {
  title: string;
  rationale: string;
  /** How to progress week to week; newer plans only. */
  progression?: string;
  groups?: PlanGroup[];
  days?: LegacyPlanDay[];
}
