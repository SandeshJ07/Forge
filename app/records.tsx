import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { PersonalRecordRow } from '@/components/PersonalRecordRow';
import { usePersonalRecords } from '@/hooks/usePersonalRecords';
import { colors, spacing } from '@/constants/theme';

export default function RecordsScreen() {
  const { data: records, isLoading } = usePersonalRecords();

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Personal records</Text>
      <Text style={styles.subheading}>
        Heaviest weight logged per exercise, from manual entries and synced workouts.
      </Text>

      <Card>
        {(records ?? []).map((record) => (
          <PersonalRecordRow key={record.exercise_id} record={record} />
        ))}
        {!isLoading && !records?.length ? (
          <Text style={styles.emptyText}>No records yet — log a workout with weights to get started.</Text>
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subheading: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
