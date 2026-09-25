/**
 * Equipment a user can have access to. Values are what's stored in
 * user_profiles.equipment_access and mapped to glossary equipment on the
 * backend (EQUIPMENT_ACCESS_TO_GLOSSARY in app/services/plan_generation.py) —
 * keep the two in sync. Shared by onboarding and Settings.
 */
export const EQUIPMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bands', label: 'Bands' },
];
