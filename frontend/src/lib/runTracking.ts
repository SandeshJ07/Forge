/**
 * Live run maths for the recorder screen. The server recomputes everything
 * from the saved points (backend app/services/runs.py), so these only need to
 * be close — same filters, simpler smoothing.
 */

export type RunActivity = 'run' | 'walk' | 'ride';

export interface RecordedPoint {
  lat: number;
  lng: number;
  /** Seconds since the run started (pauses included). */
  t: number;
  alt?: number | null;
  /** Horizontal accuracy in metres. */
  acc?: number | null;
}

const EARTH_RADIUS_M = 6_371_008.8;
export const MAX_ACCURACY_M = 30;
const MAX_SPEED_MPS: Record<RunActivity, number> = { run: 9, walk: 4, ride: 25 };
const MIN_STEP_M = 4;
const SMOOTHING = 5;

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const p1 = toRad(aLat);
  const p2 = toRad(bLat);
  const dp = p2 - p1;
  const dl = toRad(bLng - aLng);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Smoothed path of one segment: bad fixes dropped, positions averaged, tiny steps skipped. */
export function cleanSegment(points: RecordedPoint[], activity: RunActivity): RecordedPoint[] {
  const accepted: RecordedPoint[] = [];
  for (const p of points) {
    if (p.acc != null && p.acc > MAX_ACCURACY_M) continue;
    const prev = accepted[accepted.length - 1];
    if (prev) {
      const dt = p.t - prev.t;
      if (dt <= 0 || haversineM(prev.lat, prev.lng, p.lat, p.lng) / dt > MAX_SPEED_MPS[activity]) continue;
    }
    accepted.push(p);
  }
  const half = Math.floor(SMOOTHING / 2);
  const smoothed = accepted.map((p, i) => {
    const chunk = accepted.slice(Math.max(0, i - half), i + half + 1);
    return {
      ...p,
      lat: chunk.reduce((s, c) => s + c.lat, 0) / chunk.length,
      lng: chunk.reduce((s, c) => s + c.lng, 0) / chunk.length,
    };
  });
  const out: RecordedPoint[] = [];
  for (const p of smoothed) {
    const prev = out[out.length - 1];
    if (!prev || haversineM(prev.lat, prev.lng, p.lat, p.lng) >= MIN_STEP_M) out.push(p);
  }
  return out;
}

export function pathDistanceM(path: RecordedPoint[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineM(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
  return d;
}

/** Pace over roughly the last `windowS` seconds of a cleaned path, in seconds per km (null if too little data). */
export function recentPaceSecPerKm(path: RecordedPoint[], windowS = 30): number | null {
  if (path.length < 2) return null;
  const end = path[path.length - 1];
  let i = path.length - 1;
  while (i > 0 && end.t - path[i - 1].t <= windowS) i--;
  const slice = path.slice(Math.max(0, i - 1));
  const d = pathDistanceM(slice);
  const t = end.t - slice[0].t;
  return d >= 20 && t > 0 ? (t / d) * 1000 : null;
}

/** 330 → "5:30". */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return '–:––';
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Distance in the user's unit: "5.23 km" / "3.25 mi". */
export function formatDistance(meters: number, imperial: boolean, decimals = 2): string {
  return imperial ? `${(meters / 1609.344).toFixed(decimals)} mi` : `${(meters / 1000).toFixed(decimals)} km`;
}

/** Pace in the user's unit (per km or per mile). */
export function paceFor(secPerKm: number | null, imperial: boolean): string {
  return `${formatPace(secPerKm == null ? null : imperial ? secPerKm * 1.609344 : secPerKm)} /${imperial ? 'mi' : 'km'}`;
}

export const ACTIVITY_LABELS: Record<RunActivity, { label: string; icon: 'walk-outline' | 'bicycle-outline' | 'footsteps-outline' }> = {
  run: { label: 'Run', icon: 'footsteps-outline' },
  walk: { label: 'Walk', icon: 'walk-outline' },
  ride: { label: 'Ride', icon: 'bicycle-outline' },
};
