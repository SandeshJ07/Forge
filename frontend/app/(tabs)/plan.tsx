import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlanView } from '@/components/PlanView';
import { PlanSectionSwitch } from '@/components/PlanSectionSwitch';
import { useLatestPlan, usePendingPlan, usePlanGeneration } from '@/hooks/usePlans';
import { useUserProfile } from '@/hooks/useUserProfile';
import { daysUntilPlanRefresh, isPlanRefreshDue, refreshIntervalDays, refreshPeriodText } from '@/lib/planRefresh';
import { formatDay } from '@/lib/format';
import { planGroups } from '@/lib/planGroups';
import { hasWorkoutInProgress, useWorkoutSessionStore } from '@/stores/useWorkoutSessionStore';
import { colors, radii, spacing } from '@/constants/theme';

/**
 * The user's exercise groups — built by AI or by hand. "Start workout" loads a group into the Log
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
  const [chooserOpen, setChooserOpen] = useState(false);

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

  const cadence = profile?.plan_refresh_cadence ?? 'monthly';
  const intervalDays = refreshIntervalDays(cadence, profile?.plan_refresh_days);
  // Counted from when the plan became current, so loading an older plan back doesn't nag straight away.
  const planSince = latestPlan ? latestPlan.accepted_at ?? latestPlan.created_at : null;
  const refreshDue = isPlanRefreshDue(planSince, intervalDays);
  const daysUntil = daysUntilPlanRefresh(planSince, intervalDays);

  // Every generation goes through the preferences screen first, so the user
  // can set training days and muscles before a (paid) AI call is made.
  function handleGenerate() {
    router.push('/plan/new');
  }

  function handleBuild() {
    setChooserOpen(false);
    router.push('/plan/custom');
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
              onPress={() => setChooserOpen((v) => !v)}
              disabled={isGenerating}
            />
          ) : null
        }
      />
      <PlanSectionSwitch active="workouts" />

      {chooserOpen && latestPlan && !isGenerating ? (
        <Card style={styles.chooserCard}>
          <Text style={styles.reminderTitle}>Make a new plan</Text>
          <NewPlanOptions
            onAI={() => {
              setChooserOpen(false);
              handleGenerate();
            }}
            onBuild={handleBuild}
          />
        </Card>
      ) : null}

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
              It's been {refreshPeriodText(cadence, profile?.plan_refresh_days)} since you started this plan. New ones will reflect your latest progress.
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
            Have AI build workout groups from your goals, experience, equipment and history — or put them together
            yourself. Groups mapped to a weekday are suggested on that day when you log a workout, and any group can be
            loaded whenever you like.
          </Text>
          <View style={styles.emptyOptions}>
            <NewPlanOptions onAI={handleGenerate} onBuild={handleBuild} />
          </View>
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
          <View style={styles.linkRow}>
            <Text style={styles.link} onPress={() => router.push('/plan/custom?from=latest')} accessibilityRole="link">
              Edit this plan
            </Text>
            <Text style={styles.linkDivider}>·</Text>
            <Text style={styles.link} onPress={() => router.push('/plan/history')} accessibilityRole="link">
              Past plans
            </Text>
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

/** The two ways to make a plan: AI, or by hand. */
function NewPlanOptions({ onAI, onBuild }: { onAI: () => void; onBuild: () => void }) {
  return (
    <View style={styles.options}>
      <PlanOption
        icon="sparkles-outline"
        title="Create with AI"
        subtitle="Pick your days and muscles; AI fills in the exercises."
        onPress={onAI}
      />
      <PlanOption
        icon="construct-outline"
        title="Build it yourself"
        subtitle="Choose every group, exercise, set and rest time. No AI."
        onPress={onBuild}
      />
    </View>
  );
}

function PlanOption({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chooserCard: {
    gap: spacing.sm,
    borderColor: colors.primaryMuted,
  },
  emptyOptions: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    cursor: 'pointer',
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  linkDivider: {
    color: colors.textMuted,
  },
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
