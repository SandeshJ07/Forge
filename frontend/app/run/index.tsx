import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { RouteMap } from '@/components/RouteMap';
import { formatClock, useNow } from '@/components/WorkoutSessionOverlay';
import { useSaveRun } from '@/hooks/useRuns';
import { useUnitStore } from '@/stores/useUnitStore';
import { activeSeconds, flushRunStorage, useRunStore } from '@/stores/useRunStore';
import {
  geolocationSupported,
  screenWakeLockSupported,
  watchPosition,
  type GeoError,
  type GeoFix,
} from '@/lib/geolocation';
import {
  ACTIVITY_LABELS,
  MAX_ACCURACY_M,
  cleanSegment,
  formatDistance,
  paceFor,
  pathDistanceM,
  recentPaceSecPerKm,
  type RunActivity,
} from '@/lib/runTracking';
import { ApiError } from '@/lib/apiClient';
import { colors, radii, spacing } from '@/constants/theme';

const ACTIVITIES: RunActivity[] = ['run', 'walk', 'ride'];

const GEO_ERRORS: Record<GeoError, string> = {
  denied: 'Location access is blocked for Forge. Allow it in your browser or phone settings, then reload this page.',
  unavailable: "Can't get a GPS fix. Head outside with a clear view of the sky.",
  unsupported:
    Platform.OS === 'web'
      ? "This browser can't share your location."
      : 'Recording runs on the phone app is coming soon — open Forge in your phone’s browser to record a run for now.',
};

/** Record a run / walk / ride with GPS: live distance, time and pace, then save it as a workout with its route. */
export default function RecordRunScreen() {
  const router = useRouter();
  const imperial = useUnitStore((s) => s.unitSystem) === 'imperial';
  const now = useNow(1000);
  const { status, run, start, pause, resume, discard } = useRunStore();
  const saveRun = useSaveRun();

  const [activity, setActivity] = useState<RunActivity>(run?.activity ?? 'run');
  const [lastFix, setLastFix] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<GeoError | null>(geolocationSupported() ? null : 'unsupported');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // While this screen is open: warm up GPS before Start and show signal quality and where you are.
  // The points themselves are recorded app-wide by <RunTracker />.
  useEffect(() => {
    if (!geolocationSupported()) return;
    return watchPosition((fix) => {
      setGeoError(null);
      setLastFix(fix);
    }, setGeoError);
  }, []);

  const cleaned = useMemo(
    () => (run ? run.segments.map((s) => cleanSegment(s, run.activity)) : []),
    [run]
  );
  const distanceM = cleaned.reduce((d, s) => d + pathDistanceM(s), 0);
  const elapsed = run ? activeSeconds(run, now) : 0;
  const avgPace = distanceM >= 50 ? (elapsed / distanceM) * 1000 : null;
  const lastSegment = cleaned[cleaned.length - 1] ?? [];
  const currentPace = status === 'recording' ? recentPaceSecPerKm(lastSegment) : null;
  const routeSegments = useMemo(() => cleaned.map((s) => s.map((p) => [p.lat, p.lng])), [cleaned]);
  // Before the first recorded point, centre the map on where you are.
  const mapSegments = routeSegments.some((s) => s.length) || !lastFix ? routeSegments : [[[lastFix.lat, lastFix.lng]]];
  const speedKmh = currentPace ? 3600 / currentPace : null;

  const fixAge = lastFix ? (now - lastFix.timestamp) / 1000 : Infinity;
  const signal: { label: string; color: string } =
    geoError || !lastFix || fixAge > 15
      ? { label: lastFix ? 'GPS signal lost' : 'Waiting for GPS…', color: colors.warning }
      : (lastFix.acc ?? 99) <= 15
        ? { label: `GPS good · ±${Math.round(lastFix.acc ?? 0)} m`, color: colors.success }
        : (lastFix.acc ?? 99) <= MAX_ACCURACY_M
          ? { label: `GPS fair · ±${Math.round(lastFix.acc ?? 0)} m`, color: colors.warning }
          : { label: `GPS weak · ±${Math.round(lastFix.acc ?? 0)} m`, color: colors.danger };

  async function handleFinish() {
    if (!run) return;
    setErrorMessage(null);
    flushRunStorage();
    try {
      const saved = await saveRun.mutateAsync({
        activity: run.activity,
        startedAt: new Date(run.startedAt).toISOString(),
        elapsedSeconds: Math.max(1, Math.round((Date.now() - run.startedAt) / 1000)),
        segments: run.segments,
      });
      discard();
      router.replace(`/workout/${saved.workout_id}`);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't save the run. It's kept on this device — try again.");
    }
  }

  function handleDiscard() {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      setTimeout(() => setConfirmDiscard(false), 4000);
      return;
    }
    discard();
    setConfirmDiscard(false);
  }

  const recordingUnsupported = geoError === 'unsupported';

  return (
    <ScreenContainer>
      {status === 'idle' ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>What are you recording?</Text>
          <ChipGroup>
            {ACTIVITIES.map((a) => (
              <Chip
                key={a}
                label={ACTIVITY_LABELS[a].label}
                icon={ACTIVITY_LABELS[a].icon}
                selected={activity === a}
                onPress={() => setActivity(a)}
              />
            ))}
          </ChipGroup>
        </Card>
      ) : null}

      <View style={styles.statsCard}>
        <Text style={styles.bigValue} accessibilityLabel={`Distance ${formatDistance(distanceM, imperial)}`}>
          {formatDistance(distanceM, imperial)}
        </Text>
        <View style={styles.statsRow}>
          <Stat label={status === 'paused' ? 'Time · paused' : 'Time'} value={formatClock(elapsed)} />
          <Stat label="Avg pace" value={paceFor(avgPace, imperial)} />
          {run?.activity === 'ride' ? (
            <Stat label="Speed" value={speedKmh ? `${(imperial ? speedKmh / 1.609344 : speedKmh).toFixed(1)} ${imperial ? 'mph' : 'km/h'}` : '–'} />
          ) : (
            <Stat label="Current pace" value={paceFor(currentPace, imperial)} />
          )}
        </View>
      </View>

      {!recordingUnsupported ? (
        <View style={styles.signalRow} accessibilityLiveRegion="polite">
          <View style={[styles.signalDot, { backgroundColor: signal.color }]} />
          <Text style={styles.muted}>{signal.label}</Text>
        </View>
      ) : null}

      {geoError ? (
        <Card style={styles.warnCard}>
          <Ionicons name="location-outline" size={20} color={colors.warning} />
          <Text style={[styles.bodyText, styles.flex]}>{GEO_ERRORS[geoError]}</Text>
        </Card>
      ) : null}

      {!recordingUnsupported ? (
        <RouteMap segments={mapSegments} height={260} follow={status !== 'paused'} />
      ) : null}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {status === 'idle' ? (
        <>
          <Button label={`Start ${ACTIVITY_LABELS[activity].label.toLowerCase()}`} onPress={() => start(activity)} disabled={recordingUnsupported} />
          {Platform.OS === 'web' && !recordingUnsupported ? (
            <Card style={styles.tipCard}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.muted, styles.flex]}>
                Keep Forge open while you run: browsers pause GPS when the screen locks or you switch apps.
                {screenWakeLockSupported()
                  ? ' Forge keeps your screen on while recording.'
                  : ' This browser can’t keep the screen on — set auto-lock to Never before you start.'}
              </Text>
            </Card>
          ) : null}
        </>
      ) : (
        <View style={styles.actions}>
          {status === 'recording' ? (
            <View style={styles.flex}>
              <Button label="Pause" variant="secondary" onPress={pause} />
            </View>
          ) : (
            <View style={styles.flex}>
              <Button label="Resume" onPress={resume} />
            </View>
          )}
          <View style={styles.flex}>
            <Button label="Finish & save" variant={status === 'paused' ? 'secondary' : 'primary'} onPress={handleFinish} loading={saveRun.isPending} />
          </View>
        </View>
      )}

      {status !== 'idle' ? (
        <Text style={[styles.discard, confirmDiscard && styles.discardConfirm]} onPress={handleDiscard} accessibilityRole="button">
          {confirmDiscard ? 'Tap again to discard this run' : 'Discard run'}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statsCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigValue: { color: colors.text, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  signalDot: { width: 8, height: 8, borderRadius: 4 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  bodyText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  warnCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', borderColor: 'rgba(255,176,32,0.4)' },
  tipCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  error: { color: colors.danger, fontSize: 14 },
  discard: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.sm, cursor: 'pointer' },
  discardConfirm: { color: colors.danger, fontWeight: '700' },
});
