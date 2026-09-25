import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { PlanView } from '@/components/PlanView';
import { formatDayTime } from '@/lib/format';
import { usePlanHistory } from '@/hooks/usePlans';
import { colors, spacing } from '@/constants/theme';

export default function PlanHistoryScreen() {
  const { data: plans, isLoading } = usePlanHistory();

  return (
    <ScreenContainer>
      {!isLoading && !plans?.length ? <Text style={styles.emptyText}>No exercise groups yet — create them from Log workout.</Text> : null}
      {(plans ?? []).map((plan) => (
        <Card key={plan.id}>
          <Text style={styles.dateLabel}>
            {formatDayTime(plan.created_at)}
          </Text>
          <PlanView plan={plan.plan} />
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  dateLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
});
