/**
 * GPS for run recording in the browser. Browsers only report position while
 * the page is visible, so the recorder also holds a screen wake lock to keep
 * the display on. The native version is geolocation.ts.
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
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** Streams position fixes until the returned function is called. */
export function watchPosition(onFix: (fix: GeoFix) => void, onError: (error: GeoError) => void): () => void {
  if (!geolocationSupported()) {
    onError('unsupported');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        alt: pos.coords.altitude,
        acc: pos.coords.accuracy,
        timestamp: pos.timestamp || Date.now(),
      }),
    (err) => onError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

type WakeLockSentinelLike = { release: () => Promise<void>; released: boolean };

/** Keeps the screen on while recording; re-acquired when the page becomes visible again. Returns a release function. */
export function keepScreenOn(): () => void {
  const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
  if (!nav.wakeLock) return () => {};
  let sentinel: WakeLockSentinelLike | null = null;
  let active = true;
  const request = () => {
    if (!active || document.visibilityState !== 'visible') return;
    nav.wakeLock!
      .request('screen')
      .then((s) => {
        sentinel = s;
      })
      .catch(() => {});
  };
  const onVisibility = () => {
    if (!sentinel || sentinel.released) request();
  };
  request();
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisibility);
    sentinel?.release().catch(() => {});
  };
}

export function screenWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}
