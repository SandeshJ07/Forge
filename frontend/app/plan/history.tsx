import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlanView } from '@/components/PlanView';
import { formatDayTime } from '@/lib/format';
import { planGroups } from '@/lib/planGroups';
import { ApiError } from '@/lib/apiClient';
import { useAcceptPlan, useLatestPlan, usePendingPlan, usePlanHistory } from '@/hooks/usePlans';
import type { GeneratedPlan } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

/**
 * Every plan, newest first, collapsed to one line each. Expand one to see
 * its groups, and load it back to make it the current plan again (the
 * current one stays here too).
 */
export default function PlanHistoryScreen() {
  const router = useRouter();
  const { data: plans, isLoading } = usePlanHistory();
  const { data: current } = useLatestPlan();
  const { data: pending } = usePendingPlan();
  const acceptPlan = useAcceptPlan();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLoad(plan: GeneratedPlan) {
    // First tap asks, second tap replaces — the current plan isn't lost, it stays in this list.
    if (current && confirmId !== plan.id) {
      setConfirmId(plan.id);
      setTimeout(() => setConfirmId((id) => (id === plan.id ? null : id)), 4000);
      return;
    }
    setErrorMessage(null);
    try {
      await acceptPlan.mutateAsync(plan.id);
      router.replace('/plan');
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Could not load this plan. Please try again.');
    }
  }

  return (
    <ScreenContainer>
      {!isLoading && !plans?.length ? <Text style={styles.emptyText}>No plans yet — create one from the Plan tab.</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {(plans ?? []).map((plan) => {
        const expanded = expandedId === plan.id;
        const isCurrent = plan.id === current?.id;
        const isPending = plan.id === pending?.id;
        const groups = planGroups(plan.plan);
        return (
          <Card key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]}>
            <Pressable
              onPress={() => setExpandedId(expanded ? null : plan.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${plan.plan.title || 'Plan'}, ${formatDayTime(plan.created_at)}${isCurrent ? ', current plan' : ''}`}
              style={styles.header}
            >
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={expanded ? undefined : 1}>
                    {plan.plan.title || 'Plan'}
                  </Text>
                  {isCurrent ? <Badge label="Current" tone="success" /> : null}
                  {isPending ? <Badge label="New · to review" tone="primary" /> : null}
                </View>
                <Text style={styles.meta}>
                  {formatDayTime(plan.created_at)} · {groups.length} group{groups.length === 1 ? '' : 's'}
                  {groups.length ? ` · ${groups.map((g) => g.name).join(', ')}` : ''}
                </Text>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
            </Pressable>

            {expanded ? (
              <View style={styles.body}>
                <PlanView plan={plan.plan} />
                {isCurrent ? (
                  <Text style={styles.meta}>This is your current plan.</Text>
                ) : isPending ? (
                  <Button label="Review this new plan" onPress={() => router.push('/plan/review')} />
                ) : (
                  <Button
                    label={confirmId === plan.id ? 'Tap again to replace your current plan' : 'Use this plan'}
                    variant={confirmId === plan.id ? 'primary' : 'secondary'}
                    loading={acceptPlan.isPending && acceptPlan.variables === plan.id}
                    disabled={acceptPlan.isPending}
                    onPress={() => handleLoad(plan)}
                  />
                )}
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScreenContainer>
  );
}

function Badge({ label, tone }: { label: string; tone: 'success' | 'primary' }) {
  return (
    <View style={[styles.badge, tone === 'success' ? styles.badgeSuccess : styles.badgePrimary]}>
      <Text style={[styles.badgeText, { color: tone === 'success' ? colors.success : colors.primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  error: { color: colors.danger, fontSize: 14 },
  card: { gap: spacing.sm },
  cardCurrent: { borderColor: 'rgba(61,220,132,0.4)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, cursor: 'pointer' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  body: { gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  badgeSuccess: { backgroundColor: 'rgba(61,220,132,0.15)' },
  badgePrimary: { backgroundColor: colors.primaryMuted },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
