import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAddMeasurement } from '@/hooks/useMeasurements';
import { useUnitStore } from '@/stores/useUnitStore';
import type { MeasurementType } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const WEIGHT_UNIT_BY_SYSTEM = { metric: 'kg', imperial: 'lb' } as const;
const LENGTH_UNIT_BY_SYSTEM = { metric: 'cm', imperial: 'in' } as const;

function defaultUnitFor(type: MeasurementType, unitSystem: 'metric' | 'imperial'): string {
  if (type === 'body_weight') return WEIGHT_UNIT_BY_SYSTEM[unitSystem];
  if (type === 'body_fat_pct') return '%';
  return LENGTH_UNIT_BY_SYSTEM[unitSystem];
}

export function AddMeasurementForm({ type, onDone }: { type: MeasurementType; onDone?: () => void }) {
  const unitSystem = useUnitStore((s) => s.unitSystem);
  const [value, setValue] = useState('');
  const addMeasurement = useAddMeasurement();

  async function handleSubmit() {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return;
    await addMeasurement.mutateAsync({
      type,
      value: parsed,
      unit: defaultUnitFor(type, unitSystem),
      date: new Date().toISOString().slice(0, 10),
    });
    setValue('');
    onDone?.();
  }

  return (
    <View style={styles.row}>
      <View style={styles.input}>
        <TextField
          placeholder={`Value in ${defaultUnitFor(type, unitSystem)}`}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={setValue}
        />
      </View>
      <Button label="Add" onPress={handleSubmit} loading={addMeasurement.isPending} disabled={!value.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
  },
});
