import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { useDietAccess, useDietGeneration, useGenerateDietPlan, useLastDietPreferences } from '@/hooks/useDiet';
import { useUserProfile } from '@/hooks/useUserProfile';
import { providerInfo } from '@/constants/aiProviders';
import type { CookingTime, DietBudget, DietPreferences, DietType } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const DIET_TYPES: { value: DietType; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non_vegetarian', label: 'Non-vegetarian' },
  { value: 'vegan', label: 'Vegan' },
];
const MEAL_COUNTS = [2, 3, 4, 5, 6];
const BUDGETS: { value: DietBudget; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'flexible', label: 'Flexible' },
];
const COOKING_TIMES: { value: CookingTime; label: string }[] = [
  { value: 'minimal', label: 'Under 15 min' },
  { value: 'moderate', label: 'About 30 min' },
  { value: 'plenty', label: 'I enjoy cooking' },
];
const LB_PER_KG = 2.20462;

export default function DietPreferencesScreen() {
  const router = useRouter();
  const { data: access } = useDietAccess();
  const { data: profile, isPending: profilePending } = useUserProfile();
  const { data: last, isPending: lastPending } = useLastDietPreferences();
  const { data: generation } = useDietGeneration();
  const generate = useGenerateDietPlan();
  const imperial = profile?.unit_system === 'imperial';
  const unit = imperial ? 'lb' : 'kg';

  const [dietType, setDietType] = useState<DietType | null>(null);
  const [meals, setMeals] = useState(3);
  const [targetWeight, setTargetWeight] = useState('');
  const [budget, setBudget] = useState<DietBudget | undefined>();
  const [cookingTime, setCookingTime] = useState<CookingTime | undefined>();
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Start from the last request's choices, so a new plan is one tap.
  useEffect(() => {
    if (prefilled || profilePending || lastPending) return;
    if (last) {
      if (last.diet_type) setDietType(last.diet_type);
      if (last.meals_per_day) setMeals(last.meals_per_day);
      if (last.target_weight_kg) {
        const shown = imperial ? last.target_weight_kg * LB_PER_KG : last.target_weight_kg;
        setTargetWeight(String(Math.round(shown * 10) / 10));
      }
      setBudget(last.budget);
      setCookingTime(last.cooking_time);
      setNotes(last.notes ?? '');
    }
    setPrefilled(true);
  }, [prefilled, profilePending, lastPending, last, imperial]);

  const weightNumber = targetWeight.trim() ? Number(targetWeight.replace(',', '.')) : null;
  const weightKg = weightNumber === null ? null : imperial ? weightNumber / LB_PER_KG : weightNumber;
  const weightInvalid = weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300);
  const alreadyGenerating = generation?.status === 'generating';
  const hasKey = Boolean(access?.available);
  const provider = providerInfo(access?.provider ?? undefined);

  async function handleGenerate() {
    if (!dietType) return;
    setErrorMessage(null);
    const preferences: DietPreferences = {
      diet_type: dietType,
      meals_per_day: meals,
      target_weight_kg: weightKg === null ? undefined : Math.round(weightKg * 10) / 10,
      budget,
      cooking_time: cookingTime,
      notes: notes.trim() || undefined,
    };
    try {
      // Returns once the server has queued it; the diet screen shows progress.
      await generate.mutateAsync(preferences);
      router.replace('/diet');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't start your diet plan.");
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.intro}>
        Tell {provider.name} how you eat. It uses your profile, latest logged weight and training to set daily targets,
        then builds a 7-day plan. Anything optional you skip, it decides.
      </Text>

      {!hasKey ? (
        <Card style={styles.errorCard}>
          <Ionicons name="key-outline" size={18} color={colors.warning} />
          <Text style={styles.errorText}>
            Diet plans need your own Gemini or Claude API key.{' '}
            <Text style={styles.link} onPress={() => router.push('/settings')} accessibilityRole="link">
              Add one in Settings
            </Text>
            .
          </Text>
        </Card>
      ) : null}

      <Section title="How do you eat?">
        <ChipGroup>
          {DIET_TYPES.map((d) => (
            <Chip key={d.value} label={d.label} selected={dietType === d.value} onPress={() => setDietType(d.value)} />
          ))}
        </ChipGroup>
      </Section>

      <Section title="Meals a day" hint="Snacks count as meals.">
        <ChipGroup>
          {MEAL_COUNTS.map((n) => (
            <Chip key={n} label={String(n)} selected={meals === n} onPress={() => setMeals(n)} />
          ))}
        </ChipGroup>
      </Section>

      <Section
        title="Target weight"
        hint="Optional — leave empty to keep your current weight. Your latest weight from Progress is the starting point."
      >
        <View style={styles.weightRow}>
          <View style={styles.flex}>
            <TextField
              placeholder={imperial ? 'e.g. 165' : 'e.g. 72'}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              inputMode="decimal"
              accessibilityLabel={`Target weight in ${unit}`}
            />
          </View>
          <Text style={styles.unit}>{unit}</Text>
        </View>
        {weightInvalid ? (
          <Text style={styles.warning}>
            Enter a weight between {imperial ? '66 and 660 lb' : '30 and 300 kg'}.
          </Text>
        ) : null}
      </Section>

      <Section title="Budget" hint="Optional">
        <ChipGroup>
          <Chip label="Any" selected={!budget} onPress={() => setBudget(undefined)} />
          {BUDGETS.map((b) => (
            <Chip key={b.value} label={b.label} selected={budget === b.value} onPress={() => setBudget(b.value)} />
          ))}
        </ChipGroup>
      </Section>

      <Section title="Cooking time per meal" hint="Optional">
        <ChipGroup>
          <Chip label="Any" selected={!cookingTime} onPress={() => setCookingTime(undefined)} />
          {COOKING_TIMES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              selected={cookingTime === c.value}
              onPress={() => setCookingTime(c.value)}
            />
          ))}
        </ChipGroup>
      </Section>

      <Section
        title="Anything else?"
        hint="Optional — allergies, foods you dislike, cuisine you like, meal timings, health conditions."
      >
        <TextField
          placeholder="e.g. Allergic to peanuts. Prefer South Indian food. No meals after 9 pm."
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={1000}
          style={styles.notes}
        />
      </Section>

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </Card>
      ) : null}

      <Text style={styles.hint}>
        {alreadyGenerating
          ? 'A diet plan is already being built — you can start another once it’s done.'
          : `Takes up to a minute and is billed to your ${provider.company} key. You can keep using the app meanwhile.`}
      </Text>

      <Button
        label="Create diet plan"
        onPress={handleGenerate}
        loading={generate.isPending}
        disabled={!hasKey || !dietType || weightInvalid || alreadyGenerating}
      />
    </ScreenContainer>
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
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 220,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
  },
  notes: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
    cursor: 'pointer',
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
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
