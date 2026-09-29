import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { formatClock } from '@/components/WorkoutSessionOverlay';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { colors, radii, spacing } from '@/constants/theme';

/** "25:00" → 1500, "1:02:30" → 3750; a bare number is read in `bareUnit`. Null if it doesn't parse. */
export function parseClock(text: string, bareUnit: 'minutes' | 'seconds'): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return Math.round(bareUnit === 'minutes' ? n * 60 : n);
  }
  const match = /^(?:(\d+):)?(\d{1,3}):(\d{1,2})$/.exec(trimmed);
  if (!match) return null;
  const [, h, m, s] = match;
  if (Number(s) > 59 || (h && Number(m) > 59)) return null;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s);
}

interface TimeEditSheetProps {
  visible: boolean;
  title: string;
  hint: string;
  /** Current value in seconds — the field starts from it. */
  seconds: number;
  /** How a plain number is read, e.g. "40" → 40 minutes on the workout clock. */
  bareUnit: 'minutes' | 'seconds';
  max: number;
  /** Quick adjustments, in seconds (negative subtracts). */
  steps: number[];
  onSave: (seconds: number) => void;
  onClose: () => void;
}

/** Small sheet to type a time (m:ss or h:mm:ss) or nudge it with quick buttons. */
export function TimeEditSheet({ visible, title, hint, seconds, bareUnit, max, steps, onSave, onClose }: TimeEditSheetProps) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Start from the live value each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setText(formatClock(seconds));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const parsed = parseClock(text, bareUnit);

  function nudge(delta: number) {
    const base = parsed ?? seconds;
    setText(formatClock(Math.min(max, Math.max(0, base + delta))));
    setError(null);
  }

  function handleSave() {
    if (parsed === null) {
      setError('Enter a time like 25:00 or 1:05:30.');
      return;
    }
    if (parsed > max) {
      setError(`That's more than ${formatClock(max)}.`);
      return;
    }
    onSave(parsed);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, isDesktopWeb ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <TextField
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            keyboardType="numbers-and-punctuation"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={handleSave}
            accessibilityLabel={title}
            style={styles.input}
          />
          <ChipGroup>
            {steps.map((step) => (
              <Chip key={step} label={`${step > 0 ? '+' : '−'}${formatStep(Math.abs(step))}`} onPress={() => nudge(step)} />
            ))}
          </ChipGroup>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
            </View>
            <View style={styles.flex}>
              <Button label="Save" onPress={handleSave} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatStep(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  backdropCentered: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetDesktop: { width: 420, borderRadius: radii.lg },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  input: { fontSize: 28, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
