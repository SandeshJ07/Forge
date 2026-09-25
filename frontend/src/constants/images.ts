import type { ImageSourcePropType } from 'react-native';

/**
 * CC0 photography bundled with the app (see assets/onboarding/CREDITS.md).
 * Bundled rather than hotlinked so onboarding paints instantly and works offline.
 */
export const ONBOARDING_IMAGES = {
  units: require('../../assets/onboarding/units.jpg'),
  profile: require('../../assets/onboarding/profile.jpg'),
  goal: require('../../assets/onboarding/goal.jpg'),
  experience: require('../../assets/onboarding/experience.jpg'),
  equipment: require('../../assets/onboarding/equipment.jpg'),
  schedule: require('../../assets/onboarding/schedule.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type OnboardingImageName = keyof typeof ONBOARDING_IMAGES;

/** Wide hero used on the desktop sign-in and onboarding brand panels. */
export const HERO_IMAGE: ImageSourcePropType = require('../../assets/onboarding/hero.jpg');
