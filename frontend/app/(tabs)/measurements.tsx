import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Chip, ChipScroller } from '@/components/ui/Chip';
import { humanize } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MeasurementChart } from '@/components/MeasurementChart';
import { AddMeasurementForm } from '@/components/AddMeasurementForm';
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

  const allTypes = Array.from(new Set([...PRESET_TYPES, ...(customTypes ?? [])]));
  const latestUnit = measurements?.[measurements.length - 1]?.unit ?? '';

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
            label={type === 'body_fat_pct' ? 'Body fat %' : humanize(type)}
            selected={selectedType === type}
            onPress={() => setSelectedType(type)}
          />
        ))}
      </ChipScroller>

      <Card>
        <MeasurementChart measurements={measurements ?? []} unit={latestUnit} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Add today's {selectedType === 'body_fat_pct' ? 'body fat %' : humanize(selectedType).toLowerCase()}</Text>
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

const styles = StyleSheet.create({
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
