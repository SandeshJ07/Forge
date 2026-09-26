import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlanView } from '@/components/PlanView';
import { useAcceptPlan, useDismissPlan, useLatestPlan, usePendingPlan, useUpdatePlanContent } from '@/hooks/usePlans';
import { ApiError } from '@/lib/apiClient';
import { formatDayTime } from '@/lib/format';
import type { PlanPayload } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

/**
 * A freshly generated plan, before it becomes the current one. The user
 * decides: use it as is, tweak it first, regenerate with feedback, or keep
 * the plan they have. Nothing changes until they choose.
 */
export default function PlanReviewScreen() {
  const router = useRouter();
  const { data: pending, isPending } = usePendingPlan();
  const { data: current } = useLatestPlan();
  const acceptPlan = useAcceptPlan();
  const dismissPlan = useDismissPlan();
  const updatePlan = useUpdatePlanContent();

  const [draft, setDraft] = useState<PlanPayload | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Start each review from the saved plan (a new pending plan replaces any unsaved draft).
  useEffect(() => {
    setDraft(pending?.plan ?? null);
    setEditing(false);
  }, [pending?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = Boolean(pending && draft && draft !== pending.plan);
  const busy = acceptPlan.isPending || dismissPlan.isPending || updatePlan.isPending;

  function goToPlan() {
    router.replace('/plan');
  }

  function fail(err: unknown, fallback: string) {
    setErrorMessage(err instanceof ApiError ? err.message : fallback);
  }

  async function handleSaveEdits() {
    if (!pending || !draft) return;
    setErrorMessage(null);
    try {
      const saved = await updatePlan.mutateAsync({ planId: pending.id, plan: draft });
      setDraft(saved.plan);
      setEditing(false);
    } catch (err) {
      fail(err, 'Could not save your changes. Please try again.');
    }
  }

  async function handleAccept() {
    if (!pending || !draft) return;
    setErrorMessage(null);
    try {
      if (dirty) await updatePlan.mutateAsync({ planId: pending.id, plan: draft });
      await acceptPlan.mutateAsync(pending.id);
      goToPlan();
    } catch (err) {
      fail(err, 'Could not switch to this plan. Please try again.');
    }
  }

  async function handleDismiss() {
    if (!pending) return;
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      setTimeout(() => setConfirmDiscard(false), 4000);
      return;
    }
    setErrorMessage(null);
    try {
      await dismissPlan.mutateAsync(pending.id);
      goToPlan();
    } catch (err) {
      fail(err, 'Could not discard this plan. Please try again.');
    }
  }

  if (isPending) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </ScreenContainer>
    );
  }

  if (!pending || !draft) {
    return (
      <ScreenContainer>
        <Card style={styles.emptyCard}>
          <Ionicons name="checkmark-done-outline" size={32} color={colors.primary} />
          <Text style={styles.emptyTitle}>Nothing to review</Text>
          <Text style={[styles.muted, styles.centered]}>New plans show up here when they're ready, before they replace yours.</Text>
          <Button label="Go to my plan" onPress={goToPlan} />
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Card style={styles.introCard}>
        <Ionicons name="sparkles" size={22} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.introTitle}>Your new plan is ready</Text>
          <Text style={styles.muted}>
            {current
              ? `“${current.plan.title}” stays your plan until you choose to use this one.`
              : 'Look it over, adjust anything you like, then use it.'}{' '}
            Created {formatDayTime(pending.created_at)}.
          </Text>
        </View>
      </Card>

      <View style={styles.editBar}>
        {editing ? (
          <>
            <Text style={[styles.muted, styles.flex]}>Editing — change sets, targets, rest and order, or add and remove exercises.</Text>
            <Button label="Done" size="small" variant="secondary" onPress={() => setEditing(false)} />
          </>
        ) : (
          <>
            <Text style={[styles.muted, styles.flex]}>{dirty ? 'You have unsaved changes.' : 'Want to tweak something first?'}</Text>
            <Button label="Edit plan" size="small" variant="secondary" onPress={() => setEditing(true)} />
          </>
        )}
      </View>

      <PlanView plan={draft} onChange={editing ? setDraft : undefined} />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Button label={dirty ? 'Save changes and use this plan' : 'Use this plan'} onPress={handleAccept} loading={acceptPlan.isPending} disabled={busy} />
      {dirty ? (
        <Button label="Save changes for later" variant="secondary" onPress={handleSaveEdits} loading={updatePlan.isPending} disabled={busy} />
      ) : null}
      <Button
        label="Regenerate with changes"
        variant="secondary"
        onPress={() => router.push('/plan/new?revise=1')}
        disabled={busy}
      />
      <Text style={[styles.discard, confirmDiscard && styles.discardConfirm]} onPress={handleDismiss} accessibilityRole="button">
        {confirmDiscard
          ? 'Tap again to discard this plan'
          : current
            ? 'Keep my current plan'
            : 'Discard this plan'}
      </Text>
      <Text style={[styles.muted, styles.centered]}>Discarded plans stay in Past plans, so you can load them later.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: spacing.xl },
  centered: { textAlign: 'center' },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  introCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', borderColor: colors.primaryMuted },
  introTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 14 },
  discard: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.sm, cursor: 'pointer' },
  discardConfirm: { color: colors.danger, fontWeight: '700' },
});
