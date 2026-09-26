import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { MAX_REFRESH_DAYS, MIN_REFRESH_DAYS } from '@/lib/planRefresh';
import type { PlanRefreshCadence } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

/** Suggested interval when switching to Custom for the first time. */
const DEFAULT_CUSTOM_DAYS = 14;

interface RefreshReminderPickerProps {
  cadence: PlanRefreshCadence;
  days: number | null;
  /** Called with a complete choice — custom always comes with a valid number of days. */
  onChange: (cadence: PlanRefreshCadence, days: number | null) => void;
}

function clampDays(n: number): number {
  return Math.min(MAX_REFRESH_DAYS, Math.max(MIN_REFRESH_DAYS, Math.round(n)));
}

/** Monthly, or every N days. The day count is committed on −/+, blur or submit — not per keystroke. */
export function RefreshReminderPicker({ cadence, days, onChange }: RefreshReminderPickerProps) {
  const [text, setText] = useState(String(days ?? DEFAULT_CUSTOM_DAYS));

  useEffect(() => {
    if (days) setText(String(days));
  }, [days]);

  const current = clampDays(Number(text) || days || DEFAULT_CUSTOM_DAYS);

  function commit(value: number) {
    const next = clampDays(value);
    setText(String(next));
    if (cadence !== 'custom' || next !== days) onChange('custom', next);
  }

  return (
    <View style={styles.container}>
      <ChipGroup>
        <Chip label="Monthly" selected={cadence === 'monthly'} onPress={() => onChange('monthly', days)} />
        <Chip label="Custom" selected={cadence === 'custom'} onPress={() => commit(current)} />
      </ChipGroup>
      {cadence === 'custom' ? (
        <View style={styles.row}>
          <Text style={styles.label}>Every</Text>
          <StepButton
            icon="remove"
            label="One day fewer"
            disabled={current <= MIN_REFRESH_DAYS}
            onPress={() => commit(current - 1)}
          />
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => commit(current)}
            onSubmitEditing={() => commit(current)}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            style={styles.input}
            accessibilityLabel="Days between plan refresh reminders"
          />
          <StepButton
            icon="add"
            label="One day more"
            disabled={current >= MAX_REFRESH_DAYS}
            onPress={() => commit(current + 1)}
          />
          <Text style={styles.label}>day{current === 1 ? '' : 's'}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.step, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 14 },
  input: {
    width: 56,
    height: 40,
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  step: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  disabled: { opacity: 0.4 },
});
