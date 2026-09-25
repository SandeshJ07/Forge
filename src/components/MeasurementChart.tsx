import { StyleSheet, Text, View } from 'react-native';
import type { Measurement } from '@/types/database';
import { LazyTrendLine } from '@/components/LazyTrendLine';
import { formatDay } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';

interface MeasurementChartProps {
  measurements: Measurement[];
  unit: string;
}

export function MeasurementChart({ measurements, unit }: MeasurementChartProps) {
  if (measurements.length < 2) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          {measurements.length === 1
            ? `${measurements[0].value} ${unit} on ${formatDay(measurements[0].date)}. Add one more entry to see your trend.`
            : 'No entries yet. Add your first one below to start tracking.'}
        </Text>
      </View>
    );
  }

  const data = measurements.map((m, index) => ({
    x: index,
    y: m.value,
  }));

  const latest = measurements[measurements.length - 1];
  const first = measurements[0];
  const delta = latest.value - first.value;

  return (
    <View>
      <View style={styles.summaryRow}>
        <Text style={styles.latestValue}>
          {latest.value} {unit}
        </Text>
        <Text style={styles.delta}>
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)} {unit} since {formatDay(first.date)}
        </Text>
      </View>
      <View style={styles.chartContainer}>
        <LazyTrendLine data={data} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  latestValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  delta: {
    // Neutral on purpose: whether "up" is good depends on the goal and the measurement.
    color: colors.textMuted,
    fontSize: 13,
  },
  chartContainer: {
    height: 180,
  },
});
