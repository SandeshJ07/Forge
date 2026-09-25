import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDeleteMeasurement } from '@/hooks/useMeasurements';
import { formatDay } from '@/lib/format';
import type { Measurement } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const COLLAPSED_ROWS = 8;

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Every entry for one measurement, newest first, with the change from the entry before it. */
export function MeasurementHistory({ measurements }: { measurements: Measurement[] }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const deleteMeasurement = useDeleteMeasurement();

  // An untouched "Delete" confirmation reverts to the trash icon.
  useEffect(() => {
    if (!confirmId) return;
    const timer = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmId]);

  // The API returns oldest first (for the chart); history reads newest first.
  const rows = [...measurements].reverse();
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  if (!rows.length) {
    return <Text style={styles.muted}>No entries yet — add one below.</Text>;
  }

  return (
    <View>
      {shown.map((m, i) => {
        const older = rows[i + 1];
        const delta = older && older.unit === m.unit ? m.value - older.value : null;
        const confirming = confirmId === m.id;
        return (
          <View key={m.id} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Text style={[styles.date, styles.flex]}>{formatDay(m.date)}</Text>
            {delta !== null && Math.abs(delta) >= 0.05 ? (
              <Text style={styles.delta}>
                {delta > 0 ? '+' : '−'}
                {formatValue(Math.abs(delta))}
              </Text>
            ) : null}
            <Text style={styles.value}>
              {formatValue(m.value)} <Text style={styles.unit}>{m.unit}</Text>
            </Text>
            {confirming ? (
              <Pressable
                onPress={() => deleteMeasurement.mutate(m.id, { onSettled: () => setConfirmId(null) })}
                accessibilityRole="button"
                accessibilityLabel={`Confirm delete ${formatDay(m.date)} entry`}
                style={styles.confirm}
              >
                <Text style={styles.confirmText}>Delete</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setConfirmId(m.id)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${formatDay(m.date)} entry`}
                hitSlop={8}
                style={styles.trash}
              >
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        );
      })}
      {rows.length > COLLAPSED_ROWS ? (
        <Text style={styles.more} onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
          {expanded ? 'Show less' : `Show all ${rows.length} entries`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  date: { color: colors.text, fontSize: 14 },
  delta: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  value: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'right' },
  unit: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  trash: { width: 32, alignItems: 'center', cursor: 'pointer' },
  confirm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.danger,
    cursor: 'pointer',
  },
  confirmText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14 },
  more: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingTop: spacing.sm, cursor: 'pointer' },
});
