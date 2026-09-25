import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlanView } from '@/components/PlanView';
import { useLatestPlan, usePlanGeneration, useSetPlanAccepted } from '@/hooks/usePlans';
import { useUserProfile } from '@/hooks/useUserProfile';
import { daysUntilPlanRefresh, isPlanRefreshDue } from '@/lib/planRefresh';
import { formatDay } from '@/lib/format';
import { hasWorkoutInProgress, useWorkoutSessionStore } from '@/stores/useWorkoutSessionStore';
import type { PlanRefreshCadence } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const CADENCE_PERIOD: Record<PlanRefreshCadence, string> = {
  weekly: 'a week',
  biweekly: 'two weeks',
  monthly: 'a month',
};

export default function PlanScreen() {
  const router = useRouter();
  const { data: latestPlan, isLoading } = useLatestPlan();
  const { data: profile } = useUserProfile();
  const setPlanAccepted = useSetPlanAccepted();
  const activeSession = useWorkoutSessionStore((s) => s.session);
  const addPlanGroup = useWorkoutSessionStore((s) => s.addPlanGroup);
  const inProgress = hasWorkoutInProgress(activeSession);

  // Each plan group loads into the Log workout screen. One workout at a time:
  // if one's already under way, take the user back to it instead.
  function handleStartDay(dayIndex: number) {
    if (!latestPlan) return;
    if (!inProgress) addPlanGroup(latestPlan.id, dayIndex, latestPlan.plan.days[dayIndex]);
    router.push('/workout/new');
  }

  function startLabel(dayIndex: number) {
    if (!inProgress) return 'Log this workout';
    return latestPlan && activeSession?.loadedGroups.includes(`${latestPlan.id}:${dayIndex}`)
      ? 'Resume this workout'
      : 'Workout in progress — resume';
  }
  const { data: generation } = usePlanGeneration();
  const isGenerating = generation?.status === 'generating';
  // Only surface a failure that's newer than the plan on screen.
  const lastFailed =
    generation?.status === 'failed' &&
    (!latestPlan || new Date(generation.started_at ?? 0) > new Date(latestPlan.created_at));

  const cadence = profile?.plan_refresh_cadence ?? 'weekly';
  const refreshDue = isPlanRefreshDue(latestPlan?.created_at, cadence);
  const daysUntil = daysUntilPlanRefresh(latestPlan?.created_at, cadence);

  // Every generation goes through the preferences screen first, so the user
  // can set training days and per-day focus before a (paid) AI call is made.
  function handleGenerate() {
    router.push('/plan/new');
  }

  const historyLink = latestPlan ? (
    <Text style={styles.link} onPress={() => router.push('/plan/history')} accessibilityRole="link">
      History
    </Text>
  ) : null;

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Plan"
        subtitle={latestPlan ? `Generated ${formatDay(latestPlan.created_at)}` : 'Your weekly training plan'}
        right={historyLink}
      />

      {isGenerating ? (
        <Card style={styles.statusCard}>
          <ActivityIndicator color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Building your new plan…</Text>
            <Text style={styles.mutedText}>
              Feel free to explore the app — it'll appear here when it's ready.
              {latestPlan ? ' Your current plan is below until then.' : ''}
            </Text>
          </View>
        </Card>
      ) : null}

      {lastFailed ? (
        <Card style={[styles.statusCard, styles.failedCard]}>
          <Ionicons name="alert-circle" size={22} color={colors.danger} />
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Couldn't build your plan</Text>
            <Text style={styles.mutedText}>{generation?.error ?? 'Please try again.'}</Text>
            <Text style={styles.link} onPress={handleGenerate} accessibilityRole="link">
              Try again
            </Text>
          </View>
        </Card>
      ) : null}

      {latestPlan && refreshDue && !isGenerating ? (
        <Card style={styles.reminderCard}>
          <Ionicons name="refresh-circle-outline" size={22} color={colors.warning} />
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Time for a fresh plan?</Text>
            <Text style={styles.mutedText}>
              It's been {CADENCE_PERIOD[cadence]} since this plan was made. A new one will reflect your latest progress.
            </Text>
          </View>
        </Card>
      ) : null}

      {!isLoading && !latestPlan && !isGenerating ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={32} color={colors.primary} />
          <Text style={styles.emptyTitle}>No plan yet</Text>
          <Text style={[styles.mutedText, styles.centered]}>
            Get a one-week plan built from your goal, experience, equipment and workout history. You can regenerate it
            whenever you like.
          </Text>
          <Button label="Create my plan" onPress={handleGenerate} />
        </Card>
      ) : null}

      {latestPlan ? (
        <>
          <Card>
            <PlanView plan={latestPlan.plan} onStartDay={handleStartDay} startLabel={startLabel} />
          </Card>
          <View style={styles.actionsRow}>
            <View style={styles.flex}>
              <Button
                label={latestPlan.accepted ? 'Following this plan ✓' : 'Follow this plan'}
                variant={latestPlan.accepted ? 'secondary' : 'primary'}
                onPress={() => setPlanAccepted.mutate({ planId: latestPlan.id, accepted: !latestPlan.accepted })}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={isGenerating ? 'Generating…' : 'Regenerate'}
                variant={refreshDue ? 'primary' : 'secondary'}
                onPress={handleGenerate}
                disabled={isGenerating}
              />
            </View>
          </View>
          {!refreshDue && daysUntil !== null ? (
            <Text style={[styles.hint, styles.centered]}>
              Next refresh reminder in {daysUntil} day{daysUntil === 1 ? '' : 's'}. You can change this in Settings.
            </Text>
          ) : null}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
  },
  statusCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderColor: colors.primaryMuted,
  },
  failedCard: {
    borderColor: 'rgba(255,92,92,0.35)',
  },
  reminderCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderColor: 'rgba(255,176,32,0.4)',
  },
  reminderTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: radii.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
