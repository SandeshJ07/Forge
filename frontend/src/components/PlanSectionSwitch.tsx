import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';

type Section = 'workouts' | 'diet';

const SECTIONS: { value: Section; label: string; icon: keyof typeof Ionicons.glyphMap; href: '/plan' | '/diet' }[] = [
  { value: 'workouts', label: 'Workouts', icon: 'barbell-outline', href: '/plan' },
  { value: 'diet', label: 'Diet', icon: 'nutrition-outline', href: '/diet' },
];

/** Top-of-screen switch between the workout plan (Plan tab) and the diet plan. */
export function PlanSectionSwitch({ active }: { active: Section }) {
  const router = useRouter();
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {SECTIONS.map((s) => {
        const selected = s.value === active;
        return (
          <Pressable
            key={s.value}
            onPress={() => {
              if (!selected) router.navigate(s.href);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentActive]}
          >
            <Ionicons name={s.icon} size={16} color={selected ? colors.text : colors.textMuted} />
            <Text style={[styles.label, selected && styles.labelActive]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    cursor: 'pointer',
  },
  segmentActive: { backgroundColor: colors.primaryMuted },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  labelActive: { color: colors.text },
});
