import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { buildCalendarWeeks, dayKey, startOfDay, summarizeStreak } from '@/lib/streak';
import { formatDay } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';

const MIN_WEEKS = 16;
const MAX_WEEKS = 52;
const MAX_CELL = 22;
const CELL_GAP = 3;
const DAY_LABEL_WIDTH = 26;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

/**
 * One-hue sequential ramp (magnitude = workouts that day), stepped from the
 * surface toward the brand accent so "more" always reads darker→brighter.
 * Level 1 is the accent at ~55% over the card surface.
 */
const LEVEL_COLORS = [colors.surfaceAlt, '#963D2C', colors.primary];

function levelFor(count: number): number {
  return count <= 0 ? 0 : count === 1 ? 1 : 2;
}

export function StreakCard({ workoutDates }: { workoutDates: string[] }) {
  const [gridWidth, setGridWidth] = useState(0);
  const [selected, setSelected] = useState<Date | null>(null);

  const today = startOfDay(new Date());
  const summary = useMemo(() => summarizeStreak(workoutDates), [workoutDates]);
  // Phones show 16 weeks with cells shrunk to fit; wider cards show more
  // history at full cell size instead of leaving the grid half-empty.
  const usable = gridWidth - DAY_LABEL_WIDTH;
  const weeksShown =
    gridWidth > 0 ? Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.floor(usable / (MAX_CELL + CELL_GAP)))) : MIN_WEEKS;
  const weeks = useMemo(() => buildCalendarWeeks(weeksShown), [weeksShown]);
  const cellSize = gridWidth > 0 ? Math.min(MAX_CELL, Math.floor((usable - CELL_GAP * weeksShown) / weeksShown)) : 0;

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

      <View
        style={styles.grid}
        onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}
        accessibilityLabel={`Workout calendar for the last ${weeksShown} weeks`}
      >
        {cellSize > 0 ? (
          <>
            <View style={[styles.dayLabels, { width: DAY_LABEL_WIDTH, gap: CELL_GAP }]}>
              {DAY_LABELS.map((label, i) => (
                <Text key={i} style={[styles.dayLabel, { height: cellSize, lineHeight: cellSize }]}>
                  {label}
                </Text>
              ))}
            </View>
            {weeks.map((week, w) => (
              <View key={w} style={{ gap: CELL_GAP }}>
                {week.map((day) => {
                  const isFuture = day.getTime() > today.getTime();
                  const count = countsByDay.get(dayKey(day)) ?? 0;
                  const isToday = day.getTime() === today.getTime();
                  const isSelected = selected?.getTime() === day.getTime();
                  return (
                    <Pressable
                      key={day.getTime()}
                      disabled={isFuture}
                      onPress={() => setSelected(isSelected ? null : day)}
                      onHoverIn={() => setSelected(day)}
                      accessibilityLabel={`${formatDay(day)}: ${count} workout${count === 1 ? '' : 's'}`}
                      style={[
                        styles.cell,
                        {
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: isFuture ? 'transparent' : LEVEL_COLORS[levelFor(count)],
                        },
                        isToday && styles.cellToday,
                        isSelected && styles.cellSelected,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.readout} numberOfLines={1}>
          {selected
            ? `${formatDay(selected)} · ${selectedCount ? `${selectedCount} workout${selectedCount === 1 ? '' : 's'}` : 'Rest day'}`
            : `Last ${weeksShown} weeks · tap a day for details`}
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
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
    minHeight: 7 * 12,
  },
  dayLabels: {
    marginRight: 0,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  cell: {
    borderRadius: 4,
    cursor: 'pointer',
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
