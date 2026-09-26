import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { useGeneratePlan, useLatestPlan, usePlanGeneration, usePlanUsage } from '@/hooks/usePlans';
import { useUserProfile } from '@/hooks/useUserProfile';
import { providerInfo } from '@/constants/aiProviders';
import { ALL_EQUIPMENT, EQUIPMENT_GROUPS, defaultEquipmentFor } from '@/constants/equipmentCatalog';
import type { Muscle, PlanPreferences, PlanUsage, Weekday } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const WEEKDAYS: { value: Weekday; short: string; long: string }[] = [
  { value: 'mon', short: 'Mon', long: 'Monday' },
  { value: 'tue', short: 'Tue', long: 'Tuesday' },
  { value: 'wed', short: 'Wed', long: 'Wednesday' },
  { value: 'thu', short: 'Thu', long: 'Thursday' },
  { value: 'fri', short: 'Fri', long: 'Friday' },
  { value: 'sat', short: 'Sat', long: 'Saturday' },
  { value: 'sun', short: 'Sun', long: 'Sunday' },
];
const MUSCLE_OPTIONS: { value: Muscle; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'abs', label: 'Abs' },
  { value: 'lower_back', label: 'Lower back' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'cardio', label: 'Cardio' },
];
const MUSCLE_VALUES = new Set<string>(MUSCLE_OPTIONS.map((m) => m.value));
const SESSION_LENGTHS: NonNullable<PlanPreferences['session_minutes']>[] = [30, 45, 60, 90];
const DEFAULT_DAYS: Weekday[] = ['mon', 'wed', 'fri'];

/** Plans saved before per-day muscle lists stored a single focus string; keep only valid muscle arrays. */
function cleanDayFocus(raw: unknown): Partial<Record<Weekday, Muscle[]>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<Weekday, Muscle[]>> = {};
  for (const [day, muscles] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(muscles)) continue;
    const valid = muscles.filter((m): m is Muscle => typeof m === 'string' && MUSCLE_VALUES.has(m));
    if (valid.length) out[day as Weekday] = valid;
  }
  return out;
}

export default function PlanPreferencesScreen() {
  const router = useRouter();
  // "Regenerate with changes" from the review screen: same choices, plus what to change.
  const revising = useLocalSearchParams<{ revise?: string }>().revise === '1';
  const { data: latestPlan, isPending: planPending } = useLatestPlan();
  const { data: profile, isPending: profilePending } = useUserProfile();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.userId);
  const generatePlan = useGeneratePlan();
  const { data: generation } = usePlanGeneration();
  const alreadyGenerating = generation?.status === 'generating';
  const { data: usage } = usePlanUsage();
  const outOfGenerations = usage?.remaining === 0;

  const [days, setDays] = useState<Weekday[]>(DEFAULT_DAYS);
  const [dayFocus, setDayFocus] = useState<Partial<Record<Weekday, Muscle[]>>>({});
  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [sessionMinutes, setSessionMinutes] = useState<PlanPreferences['session_minutes']>();
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Start from whatever the user chose last time, so a regenerate is one tap.
  useEffect(() => {
    // isPending (not isLoading): on a fresh page load the session hydrates a moment
    // later, and until then these queries are disabled — which isLoading reports as
    // "done". Waiting for real data avoids pre-filling from nothing.
    if (prefilled || planPending || profilePending) return;
    // Saved on the profile at every "Create my plan"; older accounts fall back to the last plan's copy.
    const last = (profile?.plan_preferences ?? latestPlan?.source_summary?.preferences ?? null) as PlanPreferences | null;
    setIncludeWarmup(last?.include_warmup ?? profile?.include_warmup ?? true);
    setEquipment(
      last?.equipment ? last.equipment.filter((e) => ALL_EQUIPMENT.includes(e)) : defaultEquipmentFor(profile?.equipment_access)
    );
    if (last) {
      if (last.training_days?.length) setDays(last.training_days);
      setDayFocus(cleanDayFocus(last.day_focus));
      setSessionMinutes(last.session_minutes);
      setNotes(last.notes ?? '');
    }
    setPrefilled(true);
  }, [latestPlan, planPending, profile, profilePending, prefilled]);

  function toggleDay(day: Weekday) {
    setDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      return WEEKDAYS.map((w) => w.value).filter((d) => next.includes(d));
    });
  }

  function toggleEquipment(item: string) {
    setEquipment((prev) => (prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]));
  }

  function setMuscles(day: Weekday, muscles: Muscle[]) {
    setDayFocus((prev) => {
      const next = { ...prev };
      if (muscles.length) next[day] = muscles;
      else delete next[day];
      return next;
    });
  }

  async function handleGenerate() {
    setErrorMessage(null);
    const preferences: PlanPreferences = {
      training_days: days,
      // Only send focus for days that are still selected.
      day_focus: Object.fromEntries(Object.entries(dayFocus).filter(([d]) => days.includes(d as Weekday))),
      include_warmup: includeWarmup,
      equipment,
      session_minutes: sessionMinutes,
      notes: notes.trim() || undefined,
    };
    try {
      // Returns as soon as the server has queued the job; the AI work runs in
      // the background and the floating status pill tracks it app-wide.
      await generatePlan.mutateAsync(preferences);
      // A revision replaces the plan under review, so don't go back to it.
      if (revising) router.replace('/plan');
      else if (router.canGoBack()) router.back();
      else router.replace('/plan');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate exercise groups.');
    } finally {
      // The server saved these choices before anything else — keep the cached profile in step.
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    }
  }

  // The server may fall back to the provider it has a key for; name the one that will actually run.
  const provider = providerInfo(usage?.provider ?? profile?.ai_provider);

  return (
    <ScreenContainer>
      <Text style={styles.intro}>
        Tell {provider.name} how you want to train this week. Anything you skip, it decides based on your goals and
        history.
      </Text>

      {usage ? <UsageCard usage={usage} onOpenSettings={() => router.push('/settings')} /> : null}

      <Section title="Which days can you train?" hint={`${days.length} day${days.length === 1 ? '' : 's'} a week`}>
        <ChipGroup>
          {WEEKDAYS.map((d) => (
            <Chip key={d.value} label={d.short} showCheck selected={days.includes(d.value)} onPress={() => toggleDay(d.value)} />
          ))}
        </ChipGroup>
        {!days.length ? <Text style={styles.warning}>Pick at least one day.</Text> : null}
      </Section>

      {days.length ? (
        <Section
          title="Muscles for each day"
          hint="Optional — pick as many as you like per day. Days you leave empty, the AI fills in around your picks."
        >
          <View style={styles.focusList}>
            {WEEKDAYS.filter((d) => days.includes(d.value)).map((d) => (
              <View key={d.value} style={styles.focusRow}>
                <Text style={styles.focusDay}>{d.long}</Text>
                <View style={styles.flex}>
                  <MultiSelect
                    label={`${d.long} muscles`}
                    placeholder="AI decides"
                    options={MUSCLE_OPTIONS}
                    value={dayFocus[d.value] ?? []}
                    onChange={(v) => setMuscles(d.value, v as Muscle[])}
                  />
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      <Section
        title="Equipment you have"
        hint={
          equipment.length
            ? `${equipment.length} selected — groups only use these (plus bodyweight).`
            : 'Nothing selected — groups will be bodyweight only.'
        }
      >
        <View style={styles.equipmentActions}>
          <Text style={styles.link} onPress={() => setEquipment(ALL_EQUIPMENT)} accessibilityRole="button">
            Select all
          </Text>
          <Text style={styles.link} onPress={() => setEquipment([])} accessibilityRole="button">
            Clear
          </Text>
        </View>
        {EQUIPMENT_GROUPS.map((group) => (
          <View key={group.title} style={styles.equipmentGroup}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <ChipGroup>
              {group.items.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  showCheck
                  selected={equipment.includes(item.value)}
                  onPress={() => toggleEquipment(item.value)}
                />
              ))}
            </ChipGroup>
          </View>
        ))}
      </Section>

      <Section title="Warm-up" hint="Add a short, focus-specific warm-up to each group?">
        <ChipGroup>
          <Chip label="Include warm-up" selected={includeWarmup} onPress={() => setIncludeWarmup(true)} />
          <Chip label="No warm-up" selected={!includeWarmup} onPress={() => setIncludeWarmup(false)} />
        </ChipGroup>
      </Section>

      <Section title="Time per session" hint="Optional">
        <ChipGroup>
          <Chip label="Any" selected={!sessionMinutes} onPress={() => setSessionMinutes(undefined)} />
          {SESSION_LENGTHS.map((m) => (
            <Chip key={m} label={`${m} min`} selected={sessionMinutes === m} onPress={() => setSessionMinutes(m)} />
          ))}
        </ChipGroup>
      </Section>

      <Section
        title={revising ? 'What should change?' : 'Anything else?'}
        hint={
          revising
            ? 'Tell the AI what to do differently from the plan you just reviewed. Your current plan stays until you accept a new one.'
            : 'Optional — injuries, exercises to include, things to avoid.'
        }
      >
        <TextField
          placeholder={
            revising
              ? 'e.g. Fewer exercises per day, swap barbell rows for a machine row, add more cardio.'
              : 'e.g. Sore left knee, no jumping. Want more back work.'
          }
          autoFocus={revising}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={500}
          style={styles.notes}
        />
      </Section>

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Card>
      ) : null}

      {alreadyGenerating ? (
        <Text style={styles.generatingHint}>
          Groups are already being built — you'll be able to start another once it's done.
        </Text>
      ) : outOfGenerations ? (
        <Text style={styles.generatingHint}>
          No generations left today. Come back after midnight, or add your own API key in Settings.
        </Text>
      ) : (
        <Text style={styles.generatingHint}>
          Takes 15–30 seconds. You can keep using the app while {provider.name} works on it.
        </Text>
      )}

      <Button
        label={latestPlan ? 'Generate new plan' : 'Create Plan'}
        onPress={handleGenerate}
        loading={generatePlan.isPending}
        disabled={!days.length || alreadyGenerating || outOfGenerations}
      />
    </ScreenContainer>
  );
}

function formatResetTime(iso: string): string {
  const reset = new Date(iso);
  const time = reset.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return reset.getHours() === 0 && reset.getMinutes() === 0 ? 'midnight' : time;
}

/** Today's generations on the app's shared key, with the way out (own key) when they run low. */
function UsageCard({ usage, onOpenSettings }: { usage: PlanUsage; onOpenSettings: () => void }) {
  const provider = providerInfo(usage.provider);
  if (usage.own_key || usage.limit === null || usage.remaining === null) {
    return (
      <Card style={styles.usageCard}>
        <View style={styles.usageHead}>
          <Ionicons name="key-outline" size={18} color={colors.success} />
          <Text style={styles.usageTitle}>Using your own {provider.name} key</Text>
        </View>
        <Text style={styles.usageText}>No daily limit — generations are billed to your {provider.company} account.</Text>
      </Card>
    );
  }
  const empty = usage.remaining === 0;
  return (
    <Card style={[styles.usageCard, empty && styles.usageCardEmpty]}>
      <View style={styles.usageHead}>
        <Ionicons name="flash-outline" size={18} color={empty ? colors.warning : colors.primary} />
        <Text style={[styles.usageTitle, styles.flex]}>
          {usage.remaining} of {usage.limit} generations left today
        </Text>
      </View>
      <View
        style={styles.meter}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${usage.used} of ${usage.limit} used today`}
        accessibilityValue={{ min: 0, max: usage.limit, now: usage.used }}
      >
        {Array.from({ length: usage.limit }, (_, i) => (
          <View key={i} style={[styles.meterSegment, i < usage.used && styles.meterSegmentUsed]} />
        ))}
      </View>
      <Text style={styles.usageText}>
        Each generation uses one. The count resets at {formatResetTime(usage.resets_at)}. For more, use your own AI key —{' '}
        <Text style={styles.link} onPress={onOpenSettings} accessibilityRole="link">
          add it in Settings
        </Text>
        .
      </Text>
    </Card>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  intro: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: spacing.md,
  },
  sectionHead: {
    gap: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
  },
  focusList: {
    gap: spacing.sm,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  focusDay: {
    width: 92,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  equipmentActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: -spacing.xs,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
  },
  equipmentGroup: {
    gap: spacing.sm,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notes: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  errorCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderColor: 'rgba(255,92,92,0.35)',
  },
  errorText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  usageCard: {
    gap: spacing.sm,
    borderColor: colors.primaryMuted,
  },
  usageCardEmpty: {
    borderColor: 'rgba(255,176,32,0.4)',
  },
  usageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  usageTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  usageText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  meter: {
    flexDirection: 'row',
    gap: 4,
  },
  meterSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  meterSegmentUsed: {
    backgroundColor: colors.surfaceAlt,
  },
  generatingHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
