import { StyleSheet, Text, View } from 'react-native';
import type { PersonalRecordWithExercise } from '@/api/personalRecords';
import { colors, spacing } from '@/constants/theme';

export function PersonalRecordRow({ record }: { record: PersonalRecordWithExercise }) {
  return (
    <View style={styles.row}>
      <Text style={styles.name}>{record.exercise_name}</Text>
      <View style={styles.valueBlock}>
        <Text style={styles.weight}>
          {record.best_weight_kg}kg{record.best_weight_reps ? ` × ${record.best_weight_reps}` : ''}
        </Text>
        <Text style={styles.date}>{new Date(record.achieved_at).toLocaleDateString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
