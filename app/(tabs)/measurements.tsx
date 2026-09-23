import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MeasurementChart } from '@/components/MeasurementChart';
import { AddMeasurementForm } from '@/components/AddMeasurementForm';
import { ProgressPhotoGrid } from '@/components/ProgressPhotoGrid';
import { useAddProgressPhoto, useMeasurements, useMeasurementTypes, useProgressPhotos } from '@/hooks/useMeasurements';
import type { MeasurementType } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const PRESET_TYPES: MeasurementType[] = ['body_weight', 'chest', 'waist', 'left_arm', 'right_arm'];

export default function MeasurementsScreen() {
  const [selectedType, setSelectedType] = useState<MeasurementType>('body_weight');
  const { data: customTypes } = useMeasurementTypes();
  const { data: measurements } = useMeasurements(selectedType);
  const { data: photos } = useProgressPhotos();
  const addPhoto = useAddProgressPhoto();

  const allTypes = Array.from(new Set([...PRESET_TYPES, ...(customTypes ?? [])]));
  const latestUnit = measurements?.[measurements.length - 1]?.unit ?? '';

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Measurements</Text>

      <View style={styles.chipsRow}>
        {allTypes.map((type) => (
          <Text
            key={type}
            onPress={() => setSelectedType(type)}
            style={[styles.chip, selectedType === type && styles.chipActive]}
          >
            {type.replace(/_/g, ' ')}
          </Text>
        ))}
      </View>

      <Card>
        <MeasurementChart measurements={measurements ?? []} unit={latestUnit} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Add entry</Text>
        <AddMeasurementForm type={selectedType} />
      </Card>

      <Card>
        <View style={styles.photosHeader}>
          <Text style={styles.cardTitle}>Progress photos</Text>
          <Button
            label="Add photo"
            variant="secondary"
            onPress={() => addPhoto.mutate(new Date().toISOString().slice(0, 10))}
            loading={addPhoto.isPending}
          />
        </View>
        <ProgressPhotoGrid photos={photos ?? []} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  chipActive: {
    color: '#fff',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
