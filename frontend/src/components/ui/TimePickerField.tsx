import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { colors, radii, spacing } from '@/constants/theme';

const DIAL = 256;
const CENTER = DIAL / 2;
const NUMBER_RADIUS = 100;
const NUMBER_SIZE = 36;
const HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_LABELS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function formatTime(date: Date | number): string {
  return new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Position on the dial for step `index` of `steps` (0 at 12 o'clock, clockwise). */
function dialPoint(index: number, steps: number, radius: number) {
  const angle = (index / steps) * 2 * Math.PI;
  return { x: CENTER + radius * Math.sin(angle), y: CENTER - radius * Math.cos(angle) };
}

interface TimePickerFieldProps {
  label: string;
  /** The time is picked on this value's day. */
  value: Date;
  onChange: (date: Date) => void;
  /** Latest selectable moment; later times can't be set. Defaults to now. */
  maxDate?: Date;
}

/**
 * Tap-to-pick time of day on a clock face: tap or drag to the hour, then to
 * any minute, with an AM/PM switch. Sheet on phones, centred dialog on
 * desktop web. No native picker dependency, so it behaves the same everywhere.
 */
export function TimePickerField({ label, value, onChange, maxDate }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(value.getHours());
  const [minute, setMinute] = useState(value.getMinutes());
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();

  const max = maxDate ?? new Date();
  const at = (h: number, m: number) => {
    const next = new Date(value);
    next.setHours(h, m, 0, 0);
    return next;
  };

  const pm = hour >= 12;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const draftInvalid = at(hour, minute).getTime() > max.getTime();
  const shown = formatTime(value);

  function openPicker() {
    setHour(value.getHours());
    setMinute(value.getMinutes());
    setMode('hour');
    setOpen(true);
  }

  /** Maps a touch on the dial to the hour or minute under it. */
  function pickAt(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent;
    const angle = (Math.atan2(locationX - CENTER, CENTER - locationY) + 2 * Math.PI) % (2 * Math.PI);
    if (mode === 'hour') {
      const step = Math.round(angle / ((2 * Math.PI) / 12)) % 12; // 0 = 12 o'clock
      setHour(step + (pm ? 12 : 0));
    } else {
      setMinute(Math.round(angle / ((2 * Math.PI) / 60)) % 60);
    }
  }

  function setPeriod(nextPm: boolean) {
    if (nextPm !== pm) setHour((h) => (h + 12) % 24);
  }

  function step(delta: number) {
    if (mode === 'hour') setHour((h) => (pm ? 12 : 0) + (((h % 12) + delta + 12) % 12));
    else setMinute((m) => (m + delta + 60) % 60);
  }

  // The hand points at the selected hour (12 steps) or minute (60 steps).
  const selectedIndex = mode === 'hour' ? hour % 12 : minute;
  const steps = mode === 'hour' ? 12 : 60;
  const tip = dialPoint(selectedIndex, steps, NUMBER_RADIUS);
  const handLength = NUMBER_RADIUS;
  const handAngle = (selectedIndex / steps) * 360;
  const onLabel = mode === 'hour' || minute % 5 === 0;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}. Change time`}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons name="time-outline" size={18} color={colors.textMuted} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {shown}
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

            {/* hh:mm — tap either part to switch what the dial sets. */}
            <View style={styles.readout}>
              <Pressable
                onPress={() => setMode('hour')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'hour' }}
                accessibilityLabel={`Hour ${hour12}`}
                style={[styles.segment, mode === 'hour' && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === 'hour' && styles.segmentTextActive, draftInvalid && styles.invalidText]}>
                  {hour12}
                </Text>
              </Pressable>
              <Text style={[styles.segmentText, draftInvalid && styles.invalidText]}>:</Text>
              <Pressable
                onPress={() => setMode('minute')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'minute' }}
                accessibilityLabel={`Minute ${minute}`}
                style={[styles.segment, mode === 'minute' && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, mode === 'minute' && styles.segmentTextActive, draftInvalid && styles.invalidText]}>
                  {String(minute).padStart(2, '0')}
                </Text>
              </Pressable>
              <View style={styles.period}>
                {(['AM', 'PM'] as const).map((p) => {
                  const selected = (p === 'PM') === pm;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPeriod(p === 'PM')}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.periodButton, selected && styles.periodButtonActive]}
                    >
                      <Text style={[styles.periodText, selected && styles.segmentTextActive]}>{p}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View
              style={styles.dial}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={pickAt}
              onResponderMove={pickAt}
              // After the hour, go straight on to the minutes.
              onResponderRelease={() => mode === 'hour' && setMode('minute')}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={mode === 'hour' ? 'Hour' : 'Minute'}
              accessibilityValue={{ text: mode === 'hour' ? String(hour12) : String(minute).padStart(2, '0') }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
            >
              <View pointerEvents="none" style={[styles.centerDot, { left: CENTER - 4, top: CENTER - 4 }]} />
              <View
                pointerEvents="none"
                style={[
                  styles.hand,
                  {
                    height: handLength,
                    left: CENTER - 1,
                    top: CENTER - handLength,
                    transformOrigin: 'bottom',
                    transform: [{ rotate: `${handAngle}deg` }],
                  },
                ]}
              />
              {!onLabel ? (
                <View pointerEvents="none" style={[styles.minuteDot, { left: tip.x - 14, top: tip.y - 14 }]} />
              ) : null}
              {(mode === 'hour' ? HOUR_LABELS : MINUTE_LABELS).map((n, i) => {
                const p = dialPoint(i, 12, NUMBER_RADIUS);
                const selected = mode === 'hour' ? i === hour % 12 : n === minute;
                return (
                  <View
                    key={n}
                    pointerEvents="none"
                    style={[
                      styles.number,
                      { left: p.x - NUMBER_SIZE / 2, top: p.y - NUMBER_SIZE / 2 },
                      selected && styles.numberSelected,
                    ]}
                  >
                    <Text style={[styles.numberText, selected && styles.segmentTextActive]}>
                      {mode === 'hour' ? n : String(n).padStart(2, '0')}
                    </Text>
                  </View>
                );
              })}
            </View>

            {draftInvalid ? <Text style={styles.error}>That time hasn't happened yet.</Text> : null}
            <Button
              label="Set time"
              disabled={draftInvalid}
              onPress={() => {
                onChange(at(hour, minute));
                setOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
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
  pressed: { opacity: 0.8 },
  triggerText: { flex: 1, color: colors.text, fontSize: 16 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropCentered: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  dialog: { width: 340, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  readout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  segment: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm, cursor: 'pointer' },
  segmentActive: { backgroundColor: colors.primaryMuted },
  segmentText: { color: colors.textMuted, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  segmentTextActive: { color: colors.text },
  invalidText: { color: colors.danger },
  period: { marginLeft: spacing.sm, gap: 4 },
  periodButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    cursor: 'pointer',
  },
  periodButtonActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  periodText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: DIAL / 2,
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    touchAction: 'none',
  },
  centerDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  hand: { position: 'absolute', width: 2, backgroundColor: colors.primary },
  minuteDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  number: {
    position: 'absolute',
    width: NUMBER_SIZE,
    height: NUMBER_SIZE,
    borderRadius: NUMBER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberSelected: { backgroundColor: colors.primary },
  numberText: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
});
