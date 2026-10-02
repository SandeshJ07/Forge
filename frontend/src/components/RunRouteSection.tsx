import { useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card } from '@/components/ui/Card';
import { RouteMap } from '@/components/RouteMap';
import { formatClock } from '@/components/WorkoutSessionOverlay';
import { useRunRoute } from '@/hooks/useRuns';
import { useUnitStore } from '@/stores/useUnitStore';
import { formatDistance, formatPace, paceFor } from '@/lib/runTracking';
import { colors, radii, spacing } from '@/constants/theme';

const MILE_M = 1609.344;

/** The route map, headline numbers, per-km splits and elevation profile of a GPS-recorded workout. */
export function RunRouteSection({ workoutId }: { workoutId: string }) {
  const imperial = useUnitStore((s) => s.unitSystem) === 'imperial';
  const { data: route, isPending, isError } = useRunRoute(workoutId);

  if (isPending) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }
  if (isError || !route) return null;

  const pace = route.distance_m > 0 ? (route.moving_seconds / route.distance_m) * 1000 : null;
  const fastest = Math.min(...route.splits.map((s) => (s.seconds / s.distance_m) * 1000));
  const slowest = Math.max(...route.splits.map((s) => (s.seconds / s.distance_m) * 1000));

  return (
    <>
      <RouteMap segments={route.segments} height={280} />
      <View style={styles.grid}>
        <Stat label="Distance" value={formatDistance(route.distance_m, imperial)} />
        <Stat label="Moving time" value={formatClock(route.moving_seconds)} />
        <Stat
          label={route.activity === 'ride' ? 'Avg speed' : 'Avg pace'}
          value={
            route.activity === 'ride'
              ? `${((route.distance_m / Math.max(1, route.moving_seconds)) * (imperial ? 2.23694 : 3.6)).toFixed(1)} ${imperial ? 'mph' : 'km/h'}`
              : paceFor(pace, imperial)
          }
        />
        <Stat label="Elevation gain" value={`${Math.round(imperial ? route.elevation_gain_m * 3.28084 : route.elevation_gain_m)} ${imperial ? 'ft' : 'm'}`} />
        <Stat label="Elapsed time" value={formatClock(route.elapsed_seconds)} />
        <Stat
          label="Max speed"
          value={`${(route.max_speed_mps * (imperial ? 2.23694 : 3.6)).toFixed(1)} ${imperial ? 'mph' : 'km/h'}`}
        />
      </View>

      {route.splits.length ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Splits{imperial ? ' (per km)' : ''}</Text>
          {route.splits.map((s) => {
            const splitPace = (s.seconds / s.distance_m) * 1000;
            // Faster splits get longer bars.
            const span = slowest - fastest || 1;
            const width = 35 + (65 * (slowest - splitPace)) / span;
            return (
              <View key={s.km} style={styles.splitRow}>
                <Text style={styles.splitKm}>{s.distance_m < 1000 ? `${(s.distance_m / 1000).toFixed(2)}` : s.km}</Text>
                <View style={styles.splitBarTrack}>
                  <View style={[styles.splitBar, { width: `${width}%` }, splitPace === fastest && styles.splitBarBest]} />
                </View>
                <Text style={styles.splitPace}>{formatPace(splitPace)}</Text>
              </View>
            );
          })}
          {imperial ? <Text style={styles.muted}>A mile is {(MILE_M / 1000).toFixed(2)} km.</Text> : null}
        </Card>
      ) : null}

      {route.elevation_profile.length >= 2 ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Elevation</Text>
          <ElevationChart profile={route.elevation_profile} imperial={imperial} />
        </Card>
      ) : null}
    </>
  );
}

function ElevationChart({ profile, imperial }: { profile: number[][]; imperial: boolean }) {
  const [width, setWidth] = useState(0);
  const boxRef = useRef<View>(null);
  // On the web, onLayout can miss the first measurement; read the box directly too.
  useLayoutEffect(() => {
    const node = boxRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
    const measured = node?.getBoundingClientRect?.().width;
    if (measured && Math.round(measured) !== Math.round(width)) setWidth(measured);
  });
  const height = 90;
  const alts = profile.map((p) => p[1]);
  const minAlt = Math.min(...alts);
  const maxAlt = Math.max(...alts);
  const maxDist = profile[profile.length - 1][0] || 1;
  const span = maxAlt - minAlt || 1;
  const path = width
    ? profile
        .map(([d, a], i) => `${i ? 'L' : 'M'}${(d / maxDist) * width},${height - 6 - ((a - minAlt) / span) * (height - 12)}`)
        .join(' ') + ` L${width},${height} L0,${height} Z`
    : '';
  const unit = imperial ? 'ft' : 'm';
  const show = (m: number) => Math.round(imperial ? m * 3.28084 : m);
  return (
    <View ref={boxRef} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={`Elevation from ${show(minAlt)} to ${show(maxAlt)} ${unit}`}>
      {width ? (
        <Svg width={width} height={height}>
          <Path d={path} fill={colors.primaryMuted} stroke={colors.primary} strokeWidth={1.5} />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={styles.chartLabels}>
        <Text style={styles.muted}>
          {show(minAlt)}–{show(maxAlt)} {unit}
        </Text>
        <Text style={styles.muted}>{formatDistance(maxDist, imperial, 1)}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexBasis: '31%', flexGrow: 1, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm, gap: 2 },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  splitKm: { width: 34, color: colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  splitBarTrack: { flex: 1, height: 14, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  splitBar: { height: '100%', borderRadius: radii.sm, backgroundColor: colors.primaryMuted },
  splitBarBest: { backgroundColor: colors.primary },
  splitPace: { width: 44, color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
