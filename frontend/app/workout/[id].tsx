import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { MuscleMap } from '@/components/MuscleMap';
import { WorkoutFeedbackControl } from '@/components/WorkoutFeedbackControl';
import { formatClock } from '@/components/WorkoutSessionOverlay';
import { useWorkoutDetail } from '@/hooks/useWorkouts';
import { useUnitStore } from '@/stores/useUnitStore';
import { formatDayTime, formatWeight, humanize } from '@/lib/format';
import { muscleFills } from '@/lib/muscleMap';
import { distanceUnit, formatDuration, resolveTracking } from '@/lib/tracking';
import type { UnitSystem, WorkoutDetail, WorkoutSet } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const SECONDARY_COLOR = '#8A3A26';
const METERS_PER = { km: 1000, mi: 1609.344, m: 1, yd: 0.9144 } as const;

type DetailExercise = WorkoutDetail['exercises'][number];

/** One set as a line, e.g. "60 kg × 8", "3.2 km in 20:00", "0:45". */
function describeSet(set: WorkoutSet, exercise: DetailExercise, unitSystem: UnitSystem): string {
  const tracking = resolveTracking(exercise.tracking_type, exercise.name);
  const parts: string[] = [];
  if (set.weight_kg != null && set.weight_kg > 0) {
    parts.push(`${tracking === 'weighted_bodyweight' ? '+' : ''}${formatWeight(set.weight_kg, unitSystem)}`);
  }
  if (set.distance_meters != null && set.distance_meters > 0) {
    const unit = distanceUnit(tracking, unitSystem);
    const value = set.distance_meters / METERS_PER[unit as keyof typeof METERS_PER];
    parts.push(`${Math.round(value * 100) / 100} ${unit}`);
  }
  let line = parts.join(' · ');
  if (set.reps != null) line = line ? `${line} × ${set.reps}` : `${set.reps} reps`;
  if (set.duration_seconds != null) {
    const time = formatDuration(set.duration_seconds);
    line = line ? `${line} in ${time}` : time;
  }
  return line || 'Done';
}

function listLabel(muscles: string[]): string {
  return muscles.map(humanize).join(', ');
}

/** A logged workout: what was done, the muscles it hit, and any PRs set that day. */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const unitSystem = useUnitStore((s) => s.unitSystem);
  const { data, isPending, isError } = useWorkoutDetail(id);

  const fills = useMemo(
    () => (data ? muscleFills(data.primary_muscles, data.secondary_muscles, colors.primary, SECONDARY_COLOR) : {}),
    [data]
  );

  if (isPending) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </ScreenContainer>
    );
  }
  if (isError || !data) {
    return (
      <ScreenContainer>
        <Card style={styles.emptyCard}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.textMuted} />
          <Text style={styles.muted}>This workout couldn't be found.</Text>
        </Card>
      </ScreenContainer>
    );
  }

  const { workout, exercises, personal_records: prs } = data;
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const volumeKg = exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + (set.weight_kg ?? 0) * (set.reps ?? 0), 0),
    0
  );

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.title}>{workout.title ?? 'Workout'}</Text>
        <Text style={styles.muted}>{formatDayTime(workout.date)}</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Duration" value={workout.duration_seconds ? formatClock(workout.duration_seconds) : '—'} />
        <Stat label="Exercises" value={String(exercises.length)} />
        <Stat label="Sets" value={String(totalSets)} />
        {volumeKg > 0 ? <Stat label="Volume" value={formatWeight(volumeKg, unitSystem)} /> : null}
      </View>

      {prs.length ? (
        <Card style={styles.prCard}>
          <View style={styles.prHead}>
            <Ionicons name="trophy" size={20} color={colors.warning} />
            <Text style={styles.cardTitle}>
              {prs.length} personal record{prs.length === 1 ? '' : 's'} this session
            </Text>
          </View>
          {prs.map((pr) => (
            <View key={pr.exercise_id} style={styles.prRow}>
              <Text style={[styles.prName, styles.flex]}>{pr.name}</Text>
              <View style={styles.prValues}>
                <Text style={styles.prValue}>
                  {formatWeight(pr.weight_kg, unitSystem)}
                  {pr.reps ? ` × ${pr.reps}` : ''}
                </Text>
                <Text style={styles.muted}>
                  {pr.previous_best_kg != null ? `was ${formatWeight(pr.previous_best_kg, unitSystem)}` : 'first time'}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {data.primary_muscles.length ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Muscles targeted</Text>
          <View
            style={styles.bodies}
            accessible
            accessibilityLabel={`Muscle map. Primary: ${listLabel(data.primary_muscles)}.${
              data.secondary_muscles.length ? ` Secondary: ${listLabel(data.secondary_muscles)}.` : ''
            }`}
          >
            {(['front', 'back'] as const).map((side) => (
              <View key={side} style={styles.bodyColumn}>
                <MuscleMap side={side} fills={fills} height={200} />
                <Text style={styles.muted}>{side === 'front' ? 'Front' : 'Back'}</Text>
              </View>
            ))}
          </View>
          <Legend color={colors.primary} title="Primary" muscles={data.primary_muscles} />
          {data.secondary_muscles.length ? (
            <Legend color={SECONDARY_COLOR} title="Secondary" muscles={data.secondary_muscles} />
          ) : null}
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>Exercises</Text>
      {exercises.map((exercise, i) => (
        <Card key={`${exercise.exercise_id ?? exercise.name}-${i}`} style={styles.card}>
          <Pressable
            disabled={!exercise.exercise_id}
            onPress={() => router.push(`/exercise/${exercise.exercise_id}`)}
            accessibilityRole={exercise.exercise_id ? 'link' : undefined}
            style={[styles.exerciseHead, exercise.exercise_id ? styles.linkCursor : null]}
          >
            <View style={styles.flex}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              {exercise.muscle_groups.length ? (
                <Text style={styles.muted}>{listLabel(exercise.muscle_groups)}</Text>
              ) : null}
            </View>
            {exercise.is_pr ? (
              <View style={styles.prBadge}>
                <Ionicons name="trophy" size={12} color={colors.warning} />
                <Text style={styles.prBadgeText}>PR</Text>
              </View>
            ) : null}
            {exercise.exercise_id ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
          </Pressable>
          {exercise.sets.map((set, n) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNumber}>{n + 1}</Text>
              <Text style={styles.setText}>{describeSet(set, exercise, unitSystem)}</Text>
            </View>
          ))}
        </Card>
      ))}

      <Card style={styles.card}>
        <WorkoutFeedbackControl workout={workout} />
      </Card>
    </ScreenContainer>
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

function Legend({ color, title, muscles }: { color: string; title: string; muscles: string[] }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>
        <Text style={styles.legendTitle}>{title}: </Text>
        {listLabel(muscles)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: spacing.xl },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm, gap: 2 },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: spacing.xs },
  prCard: { gap: spacing.sm, borderColor: 'rgba(255,176,32,0.45)' },
  prHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  prName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  prValues: { alignItems: 'flex-end' },
  prValue: { color: colors.warning, fontSize: 15, fontWeight: '800' },
  bodies: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  bodyColumn: { alignItems: 'center', gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { flex: 1, color: colors.text, fontSize: 13 },
  legendTitle: { fontWeight: '700' },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkCursor: { cursor: 'pointer' },
  exerciseName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,176,32,0.15)',
  },
  prBadgeText: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setNumber: { width: 22, color: colors.textMuted, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  setText: { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'] },
});
