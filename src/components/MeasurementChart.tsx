import { StyleSheet, Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import type { Measurement } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

interface MeasurementChartProps {
  measurements: Measurement[];
  unit: string;
}

export function MeasurementChart({ measurements, unit }: MeasurementChartProps) {
  if (measurements.length < 2) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Log at least two entries to see a trend line.</Text>
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
        <Text style={[styles.delta, delta < 0 ? styles.deltaDown : styles.deltaUp]}>
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)} {unit} since first entry
        </Text>
      </View>
      <View style={styles.chartContainer}>
        <CartesianChart data={data} xKey="x" yKeys={['y']}>
          {({ points }) => (
            <Line points={points.y} color={colors.primary} strokeWidth={3} animate={{ type: 'timing', duration: 300 }} />
          )}
        </CartesianChart>
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
    fontSize: 13,
  },
  deltaUp: {
    color: colors.warning,
  },
  deltaDown: {
    color: colors.success,
  },
  chartContainer: {
    height: 180,
  },
});
