import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { formatDay } from '@/lib/format';
import { colors, radii, spacing } from '@/constants/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Month grid as weeks of 7 (Mon-first); null pads days outside the month. */
function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

interface DatePickerFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  /** Latest selectable day (inclusive). Defaults to today — workouts can't be logged in the future. */
  maxDate?: Date;
}

/**
 * Tap-to-pick date field with a month calendar. Sheet on phones, centred
 * dialog on desktop web. No native date-picker dependency, so it looks and
 * behaves the same on iOS, Android and web.
 */
export function DatePickerField({ label, value, onChange, maxDate = new Date() }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();

  const max = startOfDay(maxDate);
  const today = startOfDay(new Date());
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const atLatestMonth =
    visibleMonth.getFullYear() === max.getFullYear() && visibleMonth.getMonth() === max.getMonth();

  function openPicker() {
    setVisibleMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    setOpen(true);
  }

  function pick(date: Date) {
    onChange(date);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  const monthTitle = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDay(value)}. Change date`}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {formatDay(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.sheet, isDesktopWeb ? styles.dialog : { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close" hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ChipGroup style={styles.quickPicks}>
              <Chip label="Today" selected={sameDay(value, today)} onPress={() => pick(today)} />
              <Chip label="Yesterday" selected={sameDay(value, yesterday)} onPress={() => pick(yesterday)} />
            </ChipGroup>

            <View style={styles.monthRow}>
              <Pressable onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month" hitSlop={10} style={styles.monthNav}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                disabled={atLatestMonth}
                accessibilityLabel="Next month"
                hitSlop={10}
                style={[styles.monthNav, atLatestMonth && styles.disabled]}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>
            {monthGrid(visibleMonth.getFullYear(), visibleMonth.getMonth()).map((week, w) => (
              <View key={w} style={styles.weekRow}>
                {week.map((day, d) => {
                  if (!day) return <View key={d} style={styles.dayCell} />;
                  const disabled = day.getTime() > max.getTime();
                  const selected = sameDay(day, value);
                  const isToday = sameDay(day, today);
                  return (
                    <Pressable
                      key={d}
                      disabled={disabled}
                      onPress={() => pick(day)}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled }}
                      accessibilityLabel={day.toDateString()}
                      style={styles.dayCell}
                    >
                      <View style={[styles.dayInner, selected && styles.daySelected, !selected && isToday && styles.dayToday]}>
                        <Text style={[styles.dayText, disabled && styles.dayTextDisabled, selected && styles.dayTextSelected]}>
                          {day.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    cursor: 'pointer',
  },
  triggerPressed: {
    opacity: 0.8,
  },
  triggerText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dialog: {
    width: 380,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  quickPicks: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  monthNav: {
    padding: spacing.xs,
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.3,
  },
  monthTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: spacing.xs,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  dayText: {
    color: colors.text,
    fontSize: 15,
  },
  dayTextDisabled: {
    color: colors.border,
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});
