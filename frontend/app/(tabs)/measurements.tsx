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
import { convertMeasurement, formatMeasurement } from '@/lib/measurementUnits';
import { PROGRESS_RANGES, useProgressRangeStore } from '@/stores/useProgressRangeStore';
import { formatDay } from '@/lib/format';
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
  // Only the chosen period is charted (15 days unless the user picked another range).
  const rangeDays = useProgressRangeStore((s) => s.days);
  const setRangeDays = useProgressRangeStore((s) => s.setDays);
  const today = new Date();
  const rangeStart =
    rangeDays == null ? null : new Date(today.getFullYear(), today.getMonth(), today.getDate() - (rangeDays - 1)).getTime();
  const rangeMeasurements =
    rangeStart == null ? chartMeasurements : chartMeasurements.filter((m) => dayStart(m.date) >= rangeStart);
  const rangeLabel = PROGRESS_RANGES.find((r) => r.days === rangeDays)?.label.toLowerCase() ?? 'all time';
  const latestOverall = chartMeasurements[chartMeasurements.length - 1];
  const emptyText = latestOverall
    ? `No entries in the last ${rangeLabel}. Your latest was ${formatMeasurement(latestOverall.value)} ${chartUnit} on ${formatDay(latestOverall.date)} — pick a longer range to see it.`
    : undefined;
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
        <ChipScroller>
          {PROGRESS_RANGES.map((r) => (
            <Chip key={r.label} label={r.label} selected={rangeDays === r.days} onPress={() => setRangeDays(r.days)} />
          ))}
        </ChipScroller>
        <MeasurementChart
          measurements={rangeMeasurements}
          unit={chartUnit}
          label={typeLabel}
          target={target}
          rangeStart={rangeStart}
          emptyText={emptyText}
        />
        <View style={styles.divider} />
        <MeasurementTargetEditor type={selectedType} unit={chartUnit} label={typeLabel.toLowerCase()} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Add today's {typeLabel.toLowerCase()}</Text>
        <AddMeasurementForm type={selectedType} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>History</Text>
        <MeasurementHistory key={selectedType} measurements={measurements ?? []} />
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

/** "2026-09-24" → local midnight (it's a calendar day, not a UTC instant). */
function dayStart(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
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
