/**
 * Features switched off without removing their code. Flip to true (and set the
 * matching backend setting) to bring one back.
 */
export const FEATURES = {
  /** Progress photos on the Progress tab. Backend: PROGRESS_PHOTOS_ENABLED. */
  progressPhotos: false,
} as const;
