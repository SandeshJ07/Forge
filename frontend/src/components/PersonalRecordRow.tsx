import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PersonalRecordWithExercise } from '@/api/personalRecords';
import { useUnitStore } from '@/stores/useUnitStore';
import { formatDay, formatWeight } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';

export function PersonalRecordRow({ record }: { record: PersonalRecordWithExercise }) {
  const unitSystem = useUnitStore((s) => s.unitSystem);

  return (
    <View style={styles.row}>
      <Ionicons name="trophy-outline" size={16} color={colors.warning} />
      <Text style={styles.name} numberOfLines={1}>
        {record.exercise_name}
      </Text>
      <View style={styles.valueBlock}>
        <Text style={styles.weight}>
          {formatWeight(Number(record.best_weight_kg), unitSystem)}
          {record.best_weight_reps ? ` × ${record.best_weight_reps}` : ''}
        </Text>
        <Text style={styles.date}>{formatDay(record.achieved_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  valueBlock: {
    alignItems: 'flex-end',
  },
  weight: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
