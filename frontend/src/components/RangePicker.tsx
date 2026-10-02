import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import {
  MAX_RANGE_DAYS,
  PROGRESS_RANGE_PRESETS,
  rangeLabel,
  type ProgressRangeDays,
} from '@/stores/useProgressRangeStore';
import { colors, radii, spacing } from '@/constants/theme';

interface RangePickerProps {
  days: ProgressRangeDays;
  onChange: (days: ProgressRangeDays) => void;
}

/** "Last 15 days ▾" — opens a menu of preset durations plus a custom number of days. */
export function RangePicker({ days, onChange }: RangePickerProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const isPreset = PROGRESS_RANGE_PRESETS.some((p) => p.days === days);

  function openMenu() {
    setCustom(days != null && !isPreset ? String(days) : '');
    setError(null);
    setOpen(true);
  }

  function choose(next: ProgressRangeDays) {
    onChange(next);
    setOpen(false);
  }

  function applyCustom() {
    const n = Number(custom.trim());
    if (!Number.isInteger(n) || n < 1 || n > MAX_RANGE_DAYS) {
      setError(`Enter a whole number of days from 1 to ${MAX_RANGE_DAYS}.`);
      return;
    }
    choose(n);
  }

  return (
    <>
      <Pressable
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={`Chart period: ${rangeLabel(days)}. Change`}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
        <Text style={styles.triggerText}>{rangeLabel(days)}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.sheet, isDesktopWeb ? styles.dialog : { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Show the chart for</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close" hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {PROGRESS_RANGE_PRESETS.map((p) => {
              const selected = p.days === days;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => choose(p.days)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {p.days == null ? p.label : `Last ${p.label}`}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
            <View style={styles.customRow}>
              <View style={styles.flex}>
                <TextField
                  label={days != null && !isPreset ? `Custom (now ${days} days)` : 'Custom number of days'}
                  placeholder="e.g. 45"
                  keyboardType="number-pad"
                  inputMode="numeric"
                  value={custom}
                  onChangeText={(v) => setCustom(v.replace(/\D/g, '').slice(0, 4))}
                  onSubmitEditing={applyCustom}
                />
              </View>
              <Button label="Apply" variant="secondary" onPress={applyCustom} disabled={!custom.trim()} />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    cursor: 'pointer',
  },
  triggerText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropCentered: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    gap: 2,
  },
  dialog: { width: 360, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    cursor: 'pointer',
  },
  optionText: { color: colors.text, fontSize: 15 },
  optionTextSelected: { color: colors.primary, fontWeight: '700' },
  customRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
});
