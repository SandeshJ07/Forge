import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlanView } from '@/components/PlanView';
import { useGeneratePlan, useLatestPlan, useSetPlanAccepted } from '@/hooks/usePlans';
import { useUserProfile } from '@/hooks/useUserProfile';
import { daysUntilPlanRefresh, isPlanRefreshDue } from '@/lib/planRefresh';
import { colors, spacing } from '@/constants/theme';

export default function PlanScreen() {
  const router = useRouter();
  const { data: latestPlan, isLoading } = useLatestPlan();
  const { data: profile } = useUserProfile();
  const generatePlan = useGeneratePlan();
  const setPlanAccepted = useSetPlanAccepted();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cadence = profile?.plan_refresh_cadence ?? 'weekly';
  const refreshDue = isPlanRefreshDue(latestPlan?.created_at, cadence);
  const daysUntil = daysUntilPlanRefresh(latestPlan?.created_at, cadence);

  async function handleGenerate() {
    setErrorMessage(null);
    try {
      await generatePlan.mutateAsync();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate plan.');
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.heading}>Plan</Text>
        <Text style={styles.historyLink} onPress={() => router.push('/plan/history')}>
          History
        </Text>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {latestPlan && refreshDue ? (
        <Card style={styles.reminderCard}>
          <Text style={styles.reminderText}>
            It's been a {cadence.replace('ly', '')} — based on your progress, this might be a good time to
            regenerate your plan.
          </Text>
          <Button label="Regenerate now" variant="secondary" onPress={handleGenerate} loading={generatePlan.isPending} />
        </Card>
      ) : null}
      {latestPlan && !refreshDue && daysUntil !== null ? (
        <Text style={styles.nextRefreshHint}>
          Next refresh suggested in {daysUntil} day{daysUntil === 1 ? '' : 's'} ({cadence}).
        </Text>
      ) : null}

      {!isLoading && !latestPlan ? (
        <Card>
          <Text style={styles.emptyText}>
            No plan yet. Generate one based on your workout history, exercise preferences, and goals.
          </Text>
          <Button label="Generate a plan" onPress={handleGenerate} loading={generatePlan.isPending} />
        </Card>
      ) : null}

      {latestPlan ? (
        <>
          <Card>
            <PlanView plan={latestPlan.plan} />
          </Card>
          <View style={styles.actionsRow}>
            <Button
              label={latestPlan.accepted ? 'Accepted ✓' : 'Accept this plan'}
              variant={latestPlan.accepted ? 'secondary' : 'primary'}
              onPress={() => setPlanAccepted.mutate({ planId: latestPlan.id, accepted: !latestPlan.accepted })}
            />
            <Button
              label="Regenerate"
              variant="secondary"
              onPress={handleGenerate}
              loading={generatePlan.isPending}
            />
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  historyLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  reminderCard: {
    gap: spacing.sm,
    borderColor: colors.warning,
  },
  reminderText: {
    color: colors.text,
    fontSize: 14,
  },
  nextRefreshHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
