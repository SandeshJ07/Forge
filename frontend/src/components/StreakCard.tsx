import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { buildMonthWeeks, dayKey, startOfDay, summarizeStreak } from '@/lib/streak';
import { formatDay } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';

const CELL_GAP = 6;
/** Caps the calendar's width on wide cards so cells stay day-sized, not tiles. */
const MAX_GRID_WIDTH = 420;
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * One-hue sequential ramp (magnitude = workouts that day), stepped from the
 * surface toward the brand accent so "more" always reads darker→brighter.
 * Level 1 is the accent at ~55% over the card surface.
 */
const LEVEL_COLORS = [colors.surfaceAlt, '#963D2C', colors.primary];

function levelFor(count: number): number {
  return count <= 0 ? 0 : count === 1 ? 1 : 2;
}

/**
 * Weekly streak (counted over all of workoutDates) plus a calendar of one
 * month — the current one unless `month` (any date in it) is given.
 */
export function StreakCard({ workoutDates, month }: { workoutDates: string[]; month?: Date }) {
  const [selected, setSelected] = useState<Date | null>(null);

  const today = startOfDay(new Date());
  const summary = useMemo(() => summarizeStreak(workoutDates), [workoutDates]);
  // One month (at most 42 slots, cheap to rebuild); the streak number above
  // still counts every week.
  const shownMonth = month ?? today;
  const isCurrentMonth =
    shownMonth.getFullYear() === today.getFullYear() && shownMonth.getMonth() === today.getMonth();
  const weeks = buildMonthWeeks(shownMonth);
  const monthName = shownMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const workoutsThisMonth = weeks
    .flat()
    .reduce((n, day) => n + (day ? (summary.countsByDay.get(dayKey(day)) ?? 0) : 0), 0);

  const { currentWeeks, bestWeeks, thisWeekDone, countsByDay } = summary;
  const status = thisWeekDone
    ? "This week's done — see you next week."
    : currentWeeks > 0
      ? 'Log a workout by Sunday to keep it going.'
      : 'Work out at least once a week to build a streak.';

  const selectedCount = selected ? (countsByDay.get(dayKey(selected)) ?? 0) : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Weekly streak</Text>
          <View style={styles.heroRow}>
            <Ionicons name="flame" size={26} color={currentWeeks > 0 ? colors.primary : colors.textMuted} />
            <Text style={styles.heroValue}>{currentWeeks}</Text>
            <Text style={styles.heroUnit}>week{currentWeeks === 1 ? '' : 's'}</Text>
          </View>
          <Text style={styles.status}>{status}</Text>
        </View>
        <View style={styles.bestBlock}>
          <Text style={styles.label}>Best</Text>
          <Text style={styles.bestValue}>
            {bestWeeks} wk{bestWeeks === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <View style={styles.calendar} accessibilityLabel={`Workout calendar for ${monthName}`}>
        <Text style={styles.monthName}>{monthName}</Text>
        <View style={styles.week}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Text key={i} style={styles.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((day, d) => {
              if (!day) return <View key={d} style={styles.cellSlot} />;
              const isFuture = day.getTime() > today.getTime();
              const count = countsByDay.get(dayKey(day)) ?? 0;
              const level = levelFor(count);
              const isToday = day.getTime() === today.getTime();
              const isSelected = selected?.getTime() === day.getTime();
              return (
                <Pressable
                  key={d}
                  disabled={isFuture}
                  onPress={() => setSelected(isSelected ? null : day)}
                  onHoverIn={() => setSelected(day)}
                  accessibilityLabel={`${formatDay(day)}: ${count} workout${count === 1 ? '' : 's'}`}
                  style={[
                    styles.cellSlot,
                    styles.cell,
                    { backgroundColor: isFuture ? 'transparent' : LEVEL_COLORS[level] },
                    isToday && styles.cellToday,
                    isSelected && styles.cellSelected,
                  ]}
                >
                  <Text style={[styles.cellText, level > 0 && styles.cellTextActive, isFuture && styles.cellTextFuture]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.readout} numberOfLines={1}>
          {selected
            ? `${formatDay(selected)} · ${selectedCount ? `${selectedCount} workout${selectedCount === 1 ? '' : 's'}` : 'Rest day'}`
            : `${workoutsThisMonth} workout${workoutsThisMonth === 1 ? '' : 's'} ${
                isCurrentMonth ? 'this month' : `in ${shownMonth.toLocaleDateString(undefined, { month: 'long' })}`
              } · tap a day`}
        </Text>
        <View style={styles.legend} accessibilityLabel="Legend: none, one, two or more workouts">
          <Text style={styles.legendText}>Less</Text>
          {LEVEL_COLORS.map((color) => (
            <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
          ))}
          <Text style={styles.legendText}>More</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  heroValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  heroUnit: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  status: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  bestBlock: {
    alignItems: 'flex-end',
  },
  bestValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  calendar: {
    gap: CELL_GAP,
    width: '100%',
    maxWidth: MAX_GRID_WIDTH,
    alignSelf: 'center',
  },
  monthName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  week: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  weekdayLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  cellSlot: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
  },
  cell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cellText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  cellTextActive: {
    color: '#fff',
  },
  cellTextFuture: {
    opacity: 0.4,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: colors.warning,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  readout: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendCell: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
