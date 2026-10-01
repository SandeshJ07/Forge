/**
 * Run recording on iOS / Android isn't wired up yet: it needs expo-location
 * with a background task (so tracking continues with the screen locked) and
 * new app builds. Until then the recorder works in the web app; this native
 * stub reports "unsupported" so the screen can say so. The web version is
 * geolocation.web.ts.
 */

export interface GeoFix {
  lat: number;
  lng: number;
  alt: number | null;
  acc: number | null;
  timestamp: number;
}

export type GeoError = 'denied' | 'unavailable' | 'unsupported';

export function geolocationSupported(): boolean {
  return false;
}

export function watchPosition(_onFix: (fix: GeoFix) => void, onError: (error: GeoError) => void): () => void {
  onError('unsupported');
  return () => {};
}

export function keepScreenOn(): () => void {
  return () => {};
}

export function screenWakeLockSupported(): boolean {
  return false;
}
