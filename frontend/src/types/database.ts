// Hand-written types mirroring the backend's SQLAlchemy models (see backend/app/models/).
// Regenerate/adjust manually if the schema changes.

export type WorkoutSourceType = 'manual';
export type ExerciseFeedbackRating = 'like' | 'dislike' | 'neutral';
export type Goal = 'strength' | 'hypertrophy' | 'general_fitness' | 'endurance';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type UnitSystem = 'metric' | 'imperial';
export type AIProvider = 'anthropic' | 'gemini';
export type IntegrationProvider = AIProvider;
export type PlanRefreshCadence = 'weekly' | 'biweekly' | 'monthly';
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
  media_url: string | null;
  media_type: 'image' | 'gif' | null;
  category: string | null;
  source: string;
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
  accepted: boolean;
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
  goal: Goal | null;
  experience_level: ExperienceLevel | null;
  equipment_access: string[] | null;
  unit_system: UnitSystem;
  ai_provider: AIProvider;
  anthropic_api_key_set: boolean;
  gemini_api_key_set: boolean;
  include_warmup: boolean;
  plan_refresh_cadence: PlanRefreshCadence;
  gender: Gender | null;
  birth_year: number | null;
  height_cm: number | null;
  onboarded_at: string | null;
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
  reps: string; // e.g. "8-10" or "AMRAP"
  rest_seconds: number;
  notes?: string;
}

export interface WarmupExercise {
  exercise_name: string;
  duration_or_reps: string; // e.g. "5 min" or "2x15"
  notes?: string;
}

/** One workout's worth of exercises, loaded as a unit on the Log workout screen. */
export interface PlanGroup {
  name: string; // e.g. "Push" or "Upper A"
  focus: string; // e.g. "Chest, Shoulders, Triceps"
  /** Weekdays this group is mapped to; each weekday belongs to at most one group. */
  weekdays: Weekday[];
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
  groups?: PlanGroup[];
  days?: LegacyPlanDay[];
}
