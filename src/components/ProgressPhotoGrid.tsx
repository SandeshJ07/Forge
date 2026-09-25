import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getProgressPhotoUrl } from '@/api/measurements';
import type { ProgressPhoto } from '@/types/database';
import { formatDay } from '@/lib/format';
import { colors, radii, spacing } from '@/constants/theme';

export function ProgressPhotoGrid({ photos }: { photos: ProgressPhoto[] }) {
  if (!photos.length) {
    return (
      <Text style={styles.emptyText}>
        No photos yet. A photo every few weeks makes changes the scale misses easy to see.
      </Text>
    );
  }

  return (
    <View style={styles.grid}>
      {photos.map((photo) => (
        <ProgressPhotoThumbnail key={photo.id} photo={photo} />
      ))}
    </View>
  );
}

function ProgressPhotoThumbnail({ photo }: { photo: ProgressPhoto }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProgressPhotoUrl(photo.id).then((dataUrl) => {
      if (!cancelled) setUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  return (
    <View style={styles.thumbnailWrapper}>
      {url ? <Image source={{ uri: url }} style={styles.thumbnail} /> : <View style={styles.thumbnail} />}
      <Text style={styles.dateLabel}>{formatDay(`${photo.date}T12:00:00`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbnailWrapper: {
    width: '31%',
    gap: 2,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
  },
  dateLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
