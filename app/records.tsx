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
      <Text style={styles.subheading}>Your heaviest logged set for each exercise.</Text>

      <Card>
        {(records ?? []).map((record) => (
          <PersonalRecordRow key={record.exercise_id} record={record} />
        ))}
        {!isLoading && !records?.length ? (
          <Text style={styles.emptyText}>No records yet — log a set with weight and your best lifts will show up here.</Text>
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
