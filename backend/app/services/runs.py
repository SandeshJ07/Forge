"""
GPS run recording: turns the raw points a phone/browser recorded into a clean
route and the numbers people care about (distance, moving time, pace, splits,
elevation), and packs the route compactly for storage.

All stats are computed here from the points, not trusted from the client, so
every device shows the same numbers for the same run.
"""

import base64
import json
import math
import zlib
from dataclasses import dataclass, field

EARTH_RADIUS_M = 6_371_008.8

# Fixes worse than this are mostly noise (GPS indoors / under trees / at start-up).
MAX_ACCURACY_M = 30
# Faster than this between two fixes is a GPS jump, not running/walking/cycling.
MAX_SPEED_MPS = {"run": 9.0, "walk": 4.0, "ride": 25.0}
# Below this, you're standing still: the time doesn't count as moving time.
MOVING_SPEED_MPS = {"run": 0.8, "walk": 0.4, "ride": 1.5}
# A gap this long between fixes isn't counted as moving (lost signal, phone in a tunnel).
MAX_MOVING_GAP_S = 15
# Stored points: one every few metres is plenty for the map and splits.
MIN_STORED_SPACING_M = 4
# Small altitude wiggles are GPS noise; only climbs past this count toward elevation gain.
ELEVATION_HYSTERESIS_M = 3
PREVIEW_POINTS = 60


@dataclass
class RoutePoint:
    lat: float
    lng: float
    t: float  # seconds since the run started
    alt: float | None = None


@dataclass
class RunStats:
    distance_m: float = 0.0
    moving_seconds: int = 0
    elevation_gain_m: float = 0.0
    max_speed_mps: float = 0.0
    # Points kept per recording segment (a pause starts a new segment; the gap isn't drawn or counted).
    segments: list[list[RoutePoint]] = field(default_factory=list)
    splits: list[dict] = field(default_factory=list)
    elevation_profile: list[list[float]] = field(default_factory=list)


def haversine_m(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = p2 - p1, math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def _smooth(values: list[float], window: int = 5) -> list[float]:
    if len(values) < 3:
        return values
    half = window // 2
    out = []
    for i in range(len(values)):
        chunk = values[max(0, i - half) : i + half + 1]
        out.append(sum(chunk) / len(chunk))
    return out


# Positions are averaged over this many neighbouring fixes. GPS wanders a few metres
# around the true path every second; measured fix-to-fix, that zig-zag adds 10-20%
# to the distance. Averaging takes it out without cutting corners off a real route.
SMOOTHING_WINDOW = 5


def _clean_segment(raw: list[dict], max_speed: float) -> list[RoutePoint]:
    """Drops inaccurate fixes and GPS jumps, then smooths the positions."""
    points = sorted(
        (p for p in raw if p.get("acc") is None or p["acc"] <= MAX_ACCURACY_M), key=lambda p: p["t"]
    )
    accepted: list[dict] = []
    for p in points:
        if accepted:
            prev = accepted[-1]
            dt = p["t"] - prev["t"]
            if dt <= 0 or haversine_m(prev["lat"], prev["lng"], p["lat"], p["lng"]) / dt > max_speed:
                continue  # duplicate timestamp, or a jump no runner/rider could make
        accepted.append(p)
    lats = _smooth([p["lat"] for p in accepted], SMOOTHING_WINDOW)
    lngs = _smooth([p["lng"] for p in accepted], SMOOTHING_WINDOW)
    return [
        RoutePoint(lat=la, lng=ln, t=float(p["t"]), alt=p.get("alt")) for p, la, ln in zip(accepted, lats, lngs)
    ]


def compute_run(raw_segments: list[list[dict]], activity: str = "run") -> RunStats:
    """
    raw_segments: per recording segment, the points as recorded
    ({"lat", "lng", "t" (s since start), "alt"?, "acc"?}). Returns cleaned
    segments plus distance, moving time, splits and elevation.
    """
    max_speed = MAX_SPEED_MPS.get(activity, MAX_SPEED_MPS["run"])
    moving_speed = MOVING_SPEED_MPS.get(activity, MOVING_SPEED_MPS["run"])
    stats = RunStats()
    # (cumulative distance, t) at every kept point across segments, for splits.
    timeline: list[tuple[float, float]] = []
    elevations: list[tuple[float, float]] = []  # (cumulative distance, smoothed alt)

    for raw in raw_segments:
        points = _clean_segment(raw, max_speed)
        kept: list[RoutePoint] = []
        segment_start_dist = stats.distance_m
        for point in points:
            if not kept:
                kept.append(point)
                timeline.append((stats.distance_m, point.t))
                continue
            prev = kept[-1]
            dt = point.t - prev.t
            if dt <= 0:
                continue
            step = haversine_m(prev.lat, prev.lng, point.lat, point.lng)
            speed = step / dt
            if speed > max_speed:
                continue  # GPS jump
            if step < MIN_STORED_SPACING_M and dt < MAX_MOVING_GAP_S:
                continue  # barely moved: wait for the next fix (keeps standing-still jitter out of the distance)
            moving = speed >= moving_speed
            if moving or dt > MAX_MOVING_GAP_S:
                # A real move, or ground covered while the signal dropped out — it counts as distance.
                stats.distance_m += step
            # else: standing still long enough that GPS drift crept past the spacing; keep the
            # point (so the line stays connected) but don't count the drift as distance.
            if moving and dt <= MAX_MOVING_GAP_S:
                stats.moving_seconds += int(round(dt))
            kept.append(point)
            timeline.append((stats.distance_m, point.t))
        if kept:
            stats.segments.append(kept)
            stats.max_speed_mps = max(stats.max_speed_mps, _max_sustained_speed(timeline[-len(kept) :], max_speed))
            alts = [p.alt for p in kept]
            if all(a is not None for a in alts) and len(alts) >= 2:
                smooth = _smooth([float(a) for a in alts])
                d = segment_start_dist
                elevations.append((d, smooth[0]))
                for (a, b), alt in zip(zip(kept, kept[1:]), smooth[1:]):
                    d += haversine_m(a.lat, a.lng, b.lat, b.lng)
                    elevations.append((d, alt))
                # Count a climb only once it clears the hysteresis band.
                base = smooth[0]
                for alt in smooth[1:]:
                    if alt - base >= ELEVATION_HYSTERESIS_M:
                        stats.elevation_gain_m += alt - base
                        base = alt
                    elif alt < base:
                        base = alt

    stats.distance_m = round(stats.distance_m, 1)
    stats.elevation_gain_m = round(stats.elevation_gain_m, 1)
    stats.splits = _splits(timeline)
    stats.elevation_profile = _sample(elevations, 100)
    return stats


# Max speed is measured over at least this long: fix-to-fix speeds swing with GPS noise.
MAX_SPEED_WINDOW_S = 15


def _max_sustained_speed(timeline: list[tuple[float, float]], cap: float) -> float:
    """Fastest average speed over any stretch of at least MAX_SPEED_WINDOW_S within one segment."""
    best = 0.0
    j = 0
    for i in range(len(timeline)):
        while j < len(timeline) and timeline[j][1] - timeline[i][1] < MAX_SPEED_WINDOW_S:
            j += 1
        if j == len(timeline):
            break
        dt = timeline[j][1] - timeline[i][1]
        if dt <= 3 * MAX_SPEED_WINDOW_S:  # a long gap (lost signal) isn't a speed sample
            best = max(best, (timeline[j][0] - timeline[i][0]) / dt)
    return min(best, cap)


def _splits(timeline: list[tuple[float, float]]) -> list[dict]:
    """Time for each full kilometre (interpolated at the boundary), plus the final partial one."""
    if len(timeline) < 2:
        return []
    splits = []
    km = 1
    split_start_t = timeline[0][1]
    for (d0, t0), (d1, t1) in zip(timeline, timeline[1:]):
        while d1 >= km * 1000 > d0:
            t_at = t0 + (t1 - t0) * ((km * 1000 - d0) / (d1 - d0))
            splits.append({"km": km, "distance_m": 1000, "seconds": round(t_at - split_start_t)})
            split_start_t = t_at
            km += 1
    total_d, total_t = timeline[-1]
    rest = total_d - (km - 1) * 1000
    if rest >= 50:
        splits.append({"km": km, "distance_m": round(rest), "seconds": round(total_t - split_start_t)})
    return splits


def _sample(pairs: list[tuple[float, float]], count: int) -> list[list[float]]:
    if len(pairs) <= count:
        return [[round(d), round(a, 1)] for d, a in pairs]
    step = (len(pairs) - 1) / (count - 1)
    return [[round(pairs[round(i * step)][0]), round(pairs[round(i * step)][1], 1)] for i in range(count)]


def _perpendicular_m(p: RoutePoint, a: RoutePoint, b: RoutePoint) -> float:
    # Flat approximation is fine at route scale.
    k = math.cos(math.radians(a.lat))
    ax, ay, bx, by, px, py = a.lng * k, a.lat, b.lng * k, b.lat, p.lng * k, p.lat
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return haversine_m(p.lat, p.lng, a.lat, a.lng)
    u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + u * dx), py - (ay + u * dy)) * 111_320


def simplify(points: list[RoutePoint], max_points: int = PREVIEW_POINTS) -> list[RoutePoint]:
    """Douglas-Peucker, loosening the tolerance until the route fits in max_points (for list thumbnails)."""
    if len(points) <= max_points:
        return points
    tolerance = 5.0
    while True:
        keep = [False] * len(points)
        keep[0] = keep[-1] = True
        stack = [(0, len(points) - 1)]
        while stack:
            i, j = stack.pop()
            best, idx = 0.0, None
            for k in range(i + 1, j):
                dist = _perpendicular_m(points[k], points[i], points[j])
                if dist > best:
                    best, idx = dist, k
            if idx is not None and best > tolerance:
                keep[idx] = True
                stack += [(i, idx), (idx, j)]
        result = [p for p, k in zip(points, keep) if k]
        if len(result) <= max_points:
            return result
        tolerance *= 2


# --- storage: compact JSON, zlib-compressed, then encrypted by the column type ---


def pack_route(segments: list[list[RoutePoint]]) -> str:
    data = {
        "v": 1,
        "segments": [
            [[round(p.lat, 6), round(p.lng, 6), round(p.t, 1), None if p.alt is None else round(p.alt, 1)] for p in seg]
            for seg in segments
        ],
    }
    raw = json.dumps(data, separators=(",", ":")).encode()
    return base64.b64encode(zlib.compress(raw, 9)).decode()


def unpack_route(packed: str) -> list[list[RoutePoint]]:
    data = json.loads(zlib.decompress(base64.b64decode(packed)))
    return [[RoutePoint(lat=p[0], lng=p[1], t=p[2], alt=p[3]) for p in seg] for seg in data.get("segments", [])]


def preview_of(segments: list[list[RoutePoint]]) -> list[list[float]]:
    """A small [[lat, lng], ...] outline of the whole run for list thumbnails."""
    joined = [p for seg in segments for p in seg]
    return [[round(p.lat, 5), round(p.lng, 5)] for p in simplify(joined)]
