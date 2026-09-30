import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useLatestDietPlan } from '@/hooks/useDiet';
import { colors, radii, spacing } from '@/constants/theme';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Home-screen entry to the diet plan: today's meals when there's a plan, a nudge to make one otherwise. */
export function DietTodayCard() {
  const router = useRouter();
  const { data: latest, isPending } = useLatestDietPlan();
  if (isPending) return null;

  const todayName = WEEKDAY_NAMES[new Date().getDay()];
  const days = latest?.plan.days ?? [];
  const today = days.find((d) => d.day.toLowerCase().startsWith(todayName.toLowerCase())) ?? days[0];
  const targets = latest?.plan.daily_targets;

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => router.push('/diet')}
        accessibilityRole="button"
        accessibilityLabel={latest ? "Today's meals. Open your diet plan" : 'Create a diet plan'}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <Ionicons name="nutrition-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{latest ? "Today's meals" : 'Diet plan'}</Text>
          <Text style={styles.muted}>
            {latest
              ? [
                  targets?.calories ? `${targets.calories} kcal` : null,
                  targets?.protein_g ? `${targets.protein_g} g protein` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || latest.plan.title
              : 'Meals built around your training, goals and diet.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      {today
        ? today.meals.map((meal, i) => (
            <View key={i} style={styles.meal}>
              <Text style={styles.mealName}>
                {meal.name}
                {meal.time ? <Text style={styles.muted}> · {meal.time}</Text> : null}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {meal.items.join(', ')}
              </Text>
            </View>
          ))
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, cursor: 'pointer' },
  pressed: { opacity: 0.7 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13 },
  meal: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
  mealName: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
