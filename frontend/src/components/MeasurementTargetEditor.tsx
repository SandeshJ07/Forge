import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useUpsertUserProfile, useUserProfile } from '@/hooks/useUserProfile';
import { convertMeasurement, formatMeasurement } from '@/lib/measurementUnits';
import { ApiError } from '@/lib/apiClient';
import type { MeasurementType } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

interface MeasurementTargetEditorProps {
  type: MeasurementType;
  /** The unit the chart is shown in; the target is entered and displayed in it. */
  unit: string;
  /** e.g. "body weight", for the prompt. */
  label: string;
}

/** "Target: 72 kg · Edit" — or set one. The target is the baseline on the chart above. */
export function MeasurementTargetEditor({ type, unit, label }: MeasurementTargetEditorProps) {
  const { data: profile } = useUserProfile();
  const upsert = useUpsertUserProfile();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const targets = profile?.measurement_targets ?? {};
  const saved = targets[type];
  const current = saved ? convertMeasurement(saved.value, saved.unit, unit) : null;

  function startEditing() {
    setInput(current != null ? formatMeasurement(current) : '');
    setError(null);
    setEditing(true);
  }

  async function save(next: number | null) {
    setError(null);
    const updated = { ...targets };
    if (next == null) delete updated[type];
    else updated[type] = { value: next, unit };
    try {
      await upsert.mutateAsync({ measurement_targets: updated });
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your target. Please try again.");
    }
  }

  function handleSave() {
    const value = Number(input.trim().replace(',', '.'));
    if (!input.trim() || !Number.isFinite(value) || value <= 0) {
      setError('Enter a number above 0.');
      return;
    }
    save(value);
  }

  if (editing) {
    return (
      <View style={styles.editor}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={`Target ${label} (${unit})`}
              placeholder={unit === 'kg' ? 'e.g. 72' : unit === 'lb' ? 'e.g. 160' : 'e.g. 80'}
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSave}
              autoFocus
            />
          </View>
          <Button label="Save" onPress={handleSave} loading={upsert.isPending} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.links}>
          <Text style={styles.link} onPress={() => setEditing(false)} accessibilityRole="button">
            Cancel
          </Text>
          {saved ? (
            <Text style={[styles.link, styles.remove]} onPress={() => save(null)} accessibilityRole="button">
              Remove target
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Ionicons name="flag-outline" size={18} color={current != null ? colors.success : colors.textMuted} />
      <Text style={[styles.text, styles.flex]}>
        {current != null ? (
          <>
            Target <Text style={styles.value}>{`${formatMeasurement(current)} ${unit}`}</Text>
          </>
        ) : (
          `No target ${label} yet — set one to see it as a line on the chart.`
        )}
      </Text>
      <Text style={styles.link} onPress={startEditing} accessibilityRole="button">
        {current != null ? 'Edit' : 'Set target'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editor: { gap: spacing.sm },
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  value: { color: colors.success, fontWeight: '800' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600', cursor: 'pointer' },
  remove: { color: colors.danger },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { color: colors.danger, fontSize: 13 },
});
