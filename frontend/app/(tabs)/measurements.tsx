import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Chip, ChipScroller } from '@/components/ui/Chip';
import { humanize } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MeasurementChart } from '@/components/MeasurementChart';
import { AddMeasurementForm, defaultUnitFor } from '@/components/AddMeasurementForm';
import { MeasurementTargetEditor } from '@/components/MeasurementTargetEditor';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUnitStore } from '@/stores/useUnitStore';
import { convertMeasurement } from '@/lib/measurementUnits';
import { MeasurementHistory } from '@/components/MeasurementHistory';
import { ProgressPhotoGrid } from '@/components/ProgressPhotoGrid';
import { useAddProgressPhoto, useMeasurements, useMeasurementTypes, useProgressPhotos } from '@/hooks/useMeasurements';
import type { MeasurementType } from '@/types/database';
import { FEATURES } from '@/constants/features';
import { colors, spacing } from '@/constants/theme';

const PRESET_TYPES: MeasurementType[] = ['body_weight', 'chest', 'waist', 'left_arm', 'right_arm'];

export default function MeasurementsScreen() {
  const [selectedType, setSelectedType] = useState<MeasurementType>('body_weight');
  const { data: customTypes } = useMeasurementTypes();
  const { data: measurements } = useMeasurements(selectedType);
  const { data: photos } = useProgressPhotos();
  const addPhoto = useAddProgressPhoto();

  const { data: profile } = useUserProfile();
  const unitSystem = useUnitStore((s) => s.unitSystem);

  const allTypes = Array.from(new Set([...PRESET_TYPES, ...(customTypes ?? [])]));
  // Chart in the unit of the latest entry (or the user's default one before any entries).
  const chartUnit = measurements?.[measurements.length - 1]?.unit ?? defaultUnitFor(selectedType, unitSystem);
  // Older entries in another unit (e.g. logged before switching to imperial) are converted to match.
  const chartMeasurements = (measurements ?? []).map((m) =>
    m.unit === chartUnit ? m : { ...m, value: convertMeasurement(m.value, m.unit, chartUnit), unit: chartUnit }
  );
  const savedTarget = profile?.measurement_targets?.[selectedType];
  const target = savedTarget ? convertMeasurement(savedTarget.value, savedTarget.unit, chartUnit) : null;
  const typeLabel = labelFor(selectedType);

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Progress"
        subtitle={FEATURES.progressPhotos ? 'Body measurements and progress photos' : 'Body measurements'}
      />

      <ChipScroller>
        {allTypes.map((type) => (
          <Chip
            key={type}
            label={labelFor(type)}
            selected={selectedType === type}
            onPress={() => setSelectedType(type)}
          />
        ))}
      </ChipScroller>

      <Card style={styles.chartCard}>
        <MeasurementChart measurements={chartMeasurements} unit={chartUnit} label={typeLabel} target={target} />
        <View style={styles.divider} />
        <MeasurementTargetEditor type={selectedType} unit={chartUnit} label={typeLabel.toLowerCase()} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>History</Text>
        <MeasurementHistory key={selectedType} measurements={measurements ?? []} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Add today's {typeLabel.toLowerCase()}</Text>
        <AddMeasurementForm type={selectedType} />
      </Card>

      {FEATURES.progressPhotos ? (
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
      ) : null}
    </ScreenContainer>
  );
}

function labelFor(type: MeasurementType): string {
  return type === 'body_fat_pct' ? 'Body fat %' : humanize(type);
}

const styles = StyleSheet.create({
  chartCard: {
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
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
