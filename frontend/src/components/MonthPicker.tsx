import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';

/** First day of the month containing `date`, at local midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** ‹ September 2026 › — steps a month at a time; never past the current month. */
export function MonthPicker({ month, onChange }: { month: Date; onChange: (month: Date) => void }) {
  const current = startOfMonth(new Date());
  const atCurrent = month.getTime() >= current.getTime();
  const label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.row}>
      <StepButton icon="chevron-back" label="Previous month" onPress={() => onChange(addMonths(month, -1))} />
      <Pressable
        onPress={() => onChange(current)}
        disabled={atCurrent}
        accessibilityRole="button"
        accessibilityLabel={atCurrent ? label : `${label}. Jump to this month`}
        style={styles.center}
      >
        <Text style={styles.label}>{label}</Text>
        {!atCurrent ? <Text style={styles.jump}>Back to this month</Text> : null}
      </Pressable>
      <StepButton icon="chevron-forward" label="Next month" disabled={atCurrent} onPress={() => onChange(addMonths(month, 1))} />
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.step, disabled && styles.stepDisabled, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  jump: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  step: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    cursor: 'pointer',
  },
  stepDisabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.8,
  },
});
