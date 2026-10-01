import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { PlanSectionSwitch } from '@/components/PlanSectionSwitch';
import { useDietAccess, useDietGeneration, useLatestDietPlan } from '@/hooks/useDiet';
import { providerInfo } from '@/constants/aiProviders';
import { formatDay } from '@/lib/format';
import type { DietMeal, DietPlanContent } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

/** The user's AI diet plan: daily targets, a 7-day meal plan, shopping list and tips. */
export default function DietPlanScreen() {
  const router = useRouter();
  const { data: access, isPending: accessPending } = useDietAccess();
  const { data: latest, isPending: latestPending } = useLatestDietPlan();
  const { data: generation } = useDietGeneration();

  const isGenerating = generation?.status === 'generating';
  // Only surface a failure newer than the plan on screen.
  const lastFailed =
    generation?.status === 'failed' &&
    (!latest || new Date(generation.started_at ?? 0) > new Date(latest.created_at));
  const hasKey = Boolean(access?.available);
  // Until the key check answers, don't claim there's no key — a cached plan shows meanwhile.
  const noKey = !accessPending && !hasKey;
  const provider = providerInfo(access?.provider ?? undefined);

  // Only the plan itself gates the screen; it's usually already cached on the device.
  if (latestPending) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PlanSectionSwitch active="diet" />

      {noKey ? (
        <Card style={styles.keyCard}>
          <Ionicons name="key-outline" size={22} color={colors.warning} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Diet plans use your own AI key</Text>
            <Text style={styles.mutedText}>
              Add your Claude, Gemini or Grok API key in Settings to create a diet plan. It's billed to your own account — the
              app's shared key only covers workout plans.
            </Text>
            <View style={styles.actions}>
              <Button label="Add a key in Settings" size="small" onPress={() => router.push('/settings?tab=ai')} />
            </View>
          </View>
        </Card>
      ) : null}

      {isGenerating ? (
        <Card style={styles.statusCard}>
          <ActivityIndicator color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Building your diet plan…</Text>
            <Text style={styles.mutedText}>
              Usually under a minute. Feel free to explore the app — it'll be here when it's ready.
            </Text>
          </View>
        </Card>
      ) : null}

      {lastFailed && !isGenerating ? (
        <Card style={[styles.statusCard, styles.failedCard]}>
          <Ionicons name="alert-circle" size={22} color={colors.danger} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Couldn't build your diet plan</Text>
            <Text style={styles.mutedText}>{generation?.error ?? 'Please try again.'}</Text>
            {hasKey ? (
              <Text style={styles.link} onPress={() => router.push('/diet/new')} accessibilityRole="link">
                Try again
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      {!latest && !isGenerating && hasKey ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="nutrition-outline" size={32} color={colors.primary} />
          <Text style={styles.emptyTitle}>No diet plan yet</Text>
          <Text style={[styles.mutedText, styles.centered]}>
            Tell {provider.name} how you eat — vegetarian, vegan or not, your target weight, meals a day, budget and
            cooking time — and it builds a 7-day plan with daily targets and a shopping list.
          </Text>
          <View style={styles.actions}>
            <Button label="Create diet plan" onPress={() => router.push('/diet/new')} />
          </View>
        </Card>
      ) : null}

      {latest ? (
        <>
          <View style={styles.planHead}>
            <View style={styles.flex}>
              <Text style={styles.planTitle}>{latest.plan.title}</Text>
              <Text style={styles.mutedText}>Created {formatDay(latest.created_at)}</Text>
            </View>
            {hasKey ? (
              <Button
                label={isGenerating ? 'Generating…' : 'New plan'}
                size="small"
                onPress={() => router.push('/diet/new')}
                disabled={isGenerating}
              />
            ) : null}
          </View>
          <DietPlanView plan={latest.plan} />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function DietPlanView({ plan }: { plan: DietPlanContent }) {
  // Open on today's day when the plan names weekdays, else the first day.
  const todayIndex = plan.days.findIndex((d) => d.day.toLowerCase().startsWith(WEEKDAY_NAMES[new Date().getDay()].toLowerCase()));
  const [dayIndex, setDayIndex] = useState(Math.max(0, todayIndex));
  useEffect(() => setDayIndex(Math.max(0, todayIndex)), [plan, todayIndex]);
  const day = plan.days[dayIndex] ?? plan.days[0];
  const t = plan.daily_targets;
  const dayCalories = day.meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);

  return (
    <View style={styles.planBody}>
      {plan.summary ? <Text style={styles.bodyText}>{plan.summary}</Text> : null}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Daily targets</Text>
        <View style={styles.targets}>
          <Target label="Calories" value={t.calories} unit="kcal" />
          <Target label="Protein" value={t.protein_g} unit="g" />
          <Target label="Carbs" value={t.carbs_g} unit="g" />
          <Target label="Fat" value={t.fat_g} unit="g" />
        </View>
        {plan.timeline ? <Text style={styles.mutedText}>{plan.timeline}</Text> : null}
        {plan.assumptions.length ? (
          <Text style={styles.hint}>Assumed: {plan.assumptions.join(' · ')}</Text>
        ) : null}
      </Card>

      <ChipGroup>
        {plan.days.map((d, i) => (
          <Chip key={`${d.day}-${i}`} label={d.day.slice(0, 3)} selected={i === dayIndex} onPress={() => setDayIndex(i)} />
        ))}
      </ChipGroup>

      <View style={styles.dayHead}>
        <Text style={styles.sectionTitle}>{day.day}</Text>
        {dayCalories ? <Text style={styles.mutedText}>≈ {dayCalories} kcal</Text> : null}
      </View>
      {day.meals.map((meal, i) => (
        <MealCard key={`${meal.name}-${i}`} meal={meal} />
      ))}

      {plan.shopping_list.length ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Shopping list for the week</Text>
          {plan.shopping_list.map((item, i) => (
            <Text key={i} style={styles.bullet}>
              • {item}
            </Text>
          ))}
        </Card>
      ) : null}

      {plan.tips.length ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Tips</Text>
          {plan.tips.map((tip, i) => (
            <Text key={i} style={styles.bullet}>
              • {tip}
            </Text>
          ))}
        </Card>
      ) : null}

      <Text style={[styles.hint, styles.centered]}>
        AI-generated general guidance, not medical advice. Check with a doctor or dietitian if you have a health
        condition.
      </Text>
    </View>
  );
}

function Target({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <View style={styles.target}>
      <Text style={styles.targetValue}>
        {value ?? '—'}
        {value !== null ? <Text style={styles.targetUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.targetLabel}>{label}</Text>
    </View>
  );
}

function MealCard({ meal }: { meal: DietMeal }) {
  const facts = [
    meal.calories !== null ? `${meal.calories} kcal` : null,
    meal.protein_g !== null ? `${meal.protein_g} g protein` : null,
    meal.prep_minutes ? `${meal.prep_minutes} min` : null,
  ].filter(Boolean);
  return (
    <Card style={styles.meal}>
      <View style={styles.mealHead}>
        <Text style={styles.mealName}>{meal.name}</Text>
        {meal.time ? <Text style={styles.mutedText}>{meal.time}</Text> : null}
      </View>
      {meal.items.map((item, i) => (
        <Text key={i} style={styles.bullet}>
          • {item}
        </Text>
      ))}
      {facts.length ? <Text style={styles.mealFacts}>{facts.join(' · ')}</Text> : null}
      {meal.notes ? <Text style={styles.hint}>{meal.notes}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: spacing.xl,
  },
  centered: {
    textAlign: 'center',
  },
  keyCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderColor: 'rgba(255,176,32,0.4)',
  },
  statusCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  failedCard: {
    borderColor: 'rgba(255,92,92,0.35)',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
    cursor: 'pointer',
  },
  actions: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  planBody: {
    gap: spacing.md,
  },
  bodyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  targets: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  target: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  targetValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  targetUnit: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  targetLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  meal: {
    gap: 4,
  },
  mealHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  mealName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  mealFacts: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  bullet: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
