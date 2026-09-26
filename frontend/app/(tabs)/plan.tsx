import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlanView } from '@/components/PlanView';
import { useLatestPlan, usePendingPlan, usePlanGeneration } from '@/hooks/usePlans';
import { useUserProfile } from '@/hooks/useUserProfile';
import { daysUntilPlanRefresh, isPlanRefreshDue } from '@/lib/planRefresh';
import { formatDay } from '@/lib/format';
import { planGroups } from '@/lib/planGroups';
import { hasWorkoutInProgress, useWorkoutSessionStore } from '@/stores/useWorkoutSessionStore';
import type { PlanRefreshCadence } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const CADENCE_PERIOD: Record<PlanRefreshCadence, string> = {
  weekly: 'a week',
  biweekly: 'two weeks',
  monthly: 'a month',
};

/**
 * The AI-built exercise groups. "Start workout" loads a group into the Log
 * workout screen, which also suggests today's group and can load any other.
 */
export default function ExerciseGroupsScreen() {
  const router = useRouter();
  const { data: latestPlan, isLoading } = useLatestPlan();
  const { data: pendingPlan } = usePendingPlan();
  const { data: profile } = useUserProfile();
  const { data: generation } = usePlanGeneration();
  const activeSession = useWorkoutSessionStore((s) => s.session);
  const addPlanGroup = useWorkoutSessionStore((s) => s.addPlanGroup);
  const inProgress = hasWorkoutInProgress(activeSession);

  // One workout at a time: if one's already under way, take the user back to it instead.
  function handleStart(groupIndex: number) {
    if (!latestPlan) return;
    if (!inProgress) addPlanGroup(latestPlan.id, groupIndex, planGroups(latestPlan.plan)[groupIndex]);
    router.push('/workout/new');
  }

  function startLabel(groupIndex: number) {
    if (!inProgress) return 'Start workout';
    return latestPlan && activeSession?.loadedGroups.includes(`${latestPlan.id}:${groupIndex}`)
      ? 'Resume workout'
      : 'Workout in progress — resume';
  }
  const isGenerating = generation?.status === 'generating';
  // Only surface a failure that's newer than the groups on screen.
  const lastFailed =
    generation?.status === 'failed' &&
    (!latestPlan || new Date(generation.started_at ?? 0) > new Date(latestPlan.created_at));

  const cadence = profile?.plan_refresh_cadence ?? 'weekly';
  const refreshDue = isPlanRefreshDue(latestPlan?.created_at, cadence);
  const daysUntil = daysUntilPlanRefresh(latestPlan?.created_at, cadence);

  // Every generation goes through the preferences screen first, so the user
  // can set training days and muscles before a (paid) AI call is made.
  function handleGenerate() {
    router.push('/plan/new');
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Plan"
        subtitle={latestPlan ? `Your exercise groups · created ${formatDay(latestPlan.created_at)}` : 'Your exercise groups'}
        right={
          latestPlan ? (
            <Button
              label={isGenerating ? 'Generating…' : 'New plan'}
              size="small"
              onPress={handleGenerate}
              disabled={isGenerating}
            />
          ) : null
        }
      />

      {isGenerating ? (
        <Card style={styles.statusCard}>
          <ActivityIndicator color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Building your exercise groups…</Text>
            <Text style={styles.mutedText}>
              Feel free to explore the app — they'll appear here when they're ready.
              {latestPlan ? ' Your current groups are below until then.' : ''}
            </Text>
          </View>
        </Card>
      ) : null}

      {pendingPlan && !isGenerating ? (
        <Card style={styles.reviewCard}>
          <Ionicons name="sparkles" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Your new plan is ready to review</Text>
            <Text style={styles.mutedText}>
              “{pendingPlan.plan.title}”.{' '}
              {latestPlan
                ? 'Your current plan stays until you accept the new one — you can edit it first, or keep what you have.'
                : 'Look it over and adjust anything before you start using it.'}
            </Text>
            <View style={styles.reviewActions}>
              <Button label="Review new plan" size="small" onPress={() => router.push('/plan/review')} />
            </View>
          </View>
        </Card>
      ) : null}

      {lastFailed ? (
        <Card style={[styles.statusCard, styles.failedCard]}>
          <Ionicons name="alert-circle" size={22} color={colors.danger} />
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Couldn't build your exercise groups</Text>
            <Text style={styles.mutedText}>{generation?.error ?? 'Please try again.'}</Text>
            <Text style={styles.link} onPress={handleGenerate} accessibilityRole="link">
              Try again
            </Text>
          </View>
        </Card>
      ) : null}

      {latestPlan && refreshDue && !isGenerating && !pendingPlan ? (
        <Card style={styles.reminderCard}>
          <Ionicons name="refresh-circle-outline" size={22} color={colors.warning} />
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Time for fresh groups?</Text>
            <Text style={styles.mutedText}>
              It's been {CADENCE_PERIOD[cadence]} since these were made. New ones will reflect your latest progress.
            </Text>
            <Text style={styles.link} onPress={handleGenerate} accessibilityRole="link">
              Make a new plan
            </Text>
          </View>
        </Card>
      ) : null}

      {!isLoading && !latestPlan && !isGenerating && !pendingPlan ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="albums-outline" size={32} color={colors.primary} />
          <Text style={styles.emptyTitle}>No exercise groups yet</Text>
          <Text style={[styles.mutedText, styles.centered]}>
            Get workout groups built from your goals, experience, equipment and history. Groups mapped to a weekday are
            suggested on that day when you log a workout, and any group can be loaded whenever you like.
          </Text>
          <Button label="Create Plan" onPress={handleGenerate} />
        </Card>
      ) : null}

      {latestPlan ? (
        <>
          <PlanView plan={latestPlan.plan} onStartGroup={handleStart} startLabel={startLabel} />
          {!refreshDue && daysUntil !== null ? (
            <Text style={[styles.hint, styles.centered]}>
              Next refresh reminder in {daysUntil} day{daysUntil === 1 ? '' : 's'}. You can change this in Settings.
            </Text>
          ) : null}
          <Text style={[styles.link, styles.centered]} onPress={() => router.push('/plan/history')} accessibilityRole="link">
            Past plans
          </Text>
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
  reviewCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderColor: colors.primary,
  },
  reviewActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
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
});
