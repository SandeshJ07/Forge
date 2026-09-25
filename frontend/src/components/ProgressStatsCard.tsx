import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import type { StatsOverview } from '@/api/stats';
import { useUnitStore } from '@/stores/useUnitStore';
import { formatDay, formatWeight, LB_PER_KG } from '@/lib/format';
import { colors, radii, spacing } from '@/constants/theme';

/** Heaviest familiar object the lifetime total beats, for a tangible "that's like…" line. */
const EQUIVALENTS: { kg: number; one: string; many: string }[] = [
  { kg: 150_000, one: 'blue whale', many: 'blue whales' },
  { kg: 6_000, one: 'elephant', many: 'elephants' },
  { kg: 1_500, one: 'car', many: 'cars' },
  { kg: 400, one: 'grand piano', many: 'grand pianos' },
  { kg: 80, one: 'person', many: 'people' },
];

function equivalent(totalKg: number): string | null {
  const match = EQUIVALENTS.find((e) => totalKg >= e.kg);
  if (!match) return null;
  const count = totalKg / match.kg;
  const shown = count < 10 ? Math.round(count * 10) / 10 : Math.round(count);
  return `about ${shown} ${shown === 1 ? match.one : match.many}`;
}

/** 18,420 kg / 12.4k lb — compact once it gets big. */
function formatVolume(kg: number, unitSystem: 'metric' | 'imperial'): string {
  const value = unitSystem === 'imperial' ? kg * LB_PER_KG : kg;
  const unit = unitSystem === 'imperial' ? 'lb' : 'kg';
  if (value >= 100_000) return `${Math.round(value / 1000)}k ${unit}`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

function monthName(offset: number): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toLocaleDateString(undefined, { month: 'short' });
}

/**
 * "Your progress" on Home: this month vs last (with direction spelled out, not
 * colour-only), the next workout milestone, biggest strength gains since the
 * first session, and a lifetime total made tangible.
 */
export function ProgressStatsCard({ stats }: { stats: StatsOverview }) {
  const router = useRouter();
  const unitSystem = useUnitStore((s) => s.unitSystem);
  const { this_month: now, last_month: prev, next_milestone: milestone } = stats;
  const lastMonth = monthName(-1);

  const milestoneProgress = milestone
    ? (stats.total_workouts - milestone.previous) / (milestone.target - milestone.previous)
    : 1;
  const lifetimeEquivalent = equivalent(stats.total_volume_kg);

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Your progress</Text>

      <View style={styles.tiles}>
        <MonthTile label="Workouts" value={String(now.workouts)} current={now.workouts} previous={prev.workouts} lastMonth={lastMonth} />
        <MonthTile
          label="Weight lifted"
          value={formatVolume(now.volume_kg, unitSystem)}
          current={now.volume_kg}
          previous={prev.volume_kg}
          lastMonth={lastMonth}
          percent
        />
        {/* No month-over-month delta: only each exercise's current best is stored, so last month's
            records that have since been beaten aren't counted — a comparison would mislead. */}
        <MonthTile label="Records" value={String(now.records)} current={now.records} previous={0} lastMonth={lastMonth} hint="personal bests" />
      </View>
      <Text style={styles.periodNote}>This month, compared with {lastMonth}</Text>

      {milestone ? (
        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <Text style={styles.blockTitle}>
              {stats.total_workouts ? `Workout #${stats.total_workouts} done` : 'Your first workout awaits'}
            </Text>
            <Text style={styles.muted}>
              {milestone.remaining} to go → {milestone.target}
            </Text>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: milestone.previous, max: milestone.target, now: stats.total_workouts }}
          >
            <View style={[styles.fill, { width: `${Math.max(4, milestoneProgress * 100)}%` }]} />
          </View>
        </View>
      ) : null}

      {stats.strength_gains.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Strength gains since you started</Text>
          {stats.strength_gains.map((g) => (
            <View key={g.exercise_id} style={styles.gainRow}>
              <Ionicons name="trending-up" size={16} color={colors.success} />
              <Text
                style={[styles.gainName, styles.link]}
                numberOfLines={1}
                onPress={() => router.push(`/exercise/${g.exercise_id}`)}
              >
                {g.exercise_name}
              </Text>
              <Text style={styles.gainValue}>
                {formatWeight(g.first_best_kg, unitSystem)} → {formatWeight(g.current_best_kg, unitSystem)}
              </Text>
              <Text style={styles.gainPct}>+{Math.round(g.gain_pct)}%</Text>
            </View>
          ))}
        </View>
      ) : stats.total_workouts > 0 ? (
        <Text style={styles.muted}>Repeat an exercise with more weight and your gains will show up here.</Text>
      ) : null}

      {stats.total_workouts > 0 ? (
        <View style={styles.lifetime}>
          <Ionicons name="trophy-outline" size={18} color={colors.warning} />
          <Text style={styles.lifetimeText}>
            Since {formatDay(stats.first_workout_at!)}: <Text style={styles.strong}>{stats.total_workouts} workouts</Text>,{' '}
            <Text style={styles.strong}>{stats.total_sets} sets</Text> and{' '}
            <Text style={styles.strong}>{formatVolume(stats.total_volume_kg, unitSystem)}</Text> lifted
            {lifetimeEquivalent ? ` — ${lifetimeEquivalent}.` : '.'}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function MonthTile({
  label,
  value,
  current,
  previous,
  lastMonth,
  percent = false,
  hint,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  lastMonth: string;
  percent?: boolean;
  /** Fixed caption instead of a comparison. */
  hint?: string;
}) {
  const diff = current - previous;
  let delta: string;
  if (hint) delta = hint;
  else if (previous === 0 && current === 0) delta = 'Get started';
  else if (previous === 0) delta = 'New this month';
  else if (diff === 0) delta = `Same as ${lastMonth}`;
  else delta = percent ? `${Math.abs(Math.round((diff / previous) * 100))}%` : `${Math.abs(diff)}`;

  const direction = hint || previous === 0 || diff === 0 ? null : diff > 0 ? 'up' : 'down';
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <View style={styles.deltaRow}>
        {direction ? (
          <Ionicons
            name={direction === 'up' ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={direction === 'up' ? colors.success : colors.textMuted}
          />
        ) : null}
        <Text
          style={[styles.delta, direction === 'up' && styles.deltaUp]}
          numberOfLines={1}
          accessibilityLabel={direction ? `${direction === 'up' ? 'Up' : 'Down'} ${delta} versus ${lastMonth}` : delta}
        >
          {delta}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tileValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  delta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  deltaUp: {
    color: colors.success,
  },
  periodNote: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: -spacing.sm,
  },
  block: {
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gainName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  link: {
    cursor: 'pointer',
  },
  gainValue: {
    color: colors.textMuted,
    fontSize: 13,
  },
  gainPct: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
  lifetime: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lifetimeText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  strong: {
    color: colors.text,
    fontWeight: '700',
  },
});
