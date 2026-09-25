import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useExercise, useExerciseFeedbackMap, useSetExerciseFeedback } from '@/hooks/useExercises';
import { MuscleMap } from '@/components/MuscleMap';
import { muscleFills } from '@/lib/muscleMap';
import type { Exercise, ExerciseFeedbackRating } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const FEEDBACK_OPTIONS: {
  rating: ExerciseFeedbackRating;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { rating: 'dislike', label: 'Avoid', icon: 'thumbs-down-outline', iconActive: 'thumbs-down' },
  { rating: 'neutral', label: 'Neutral', icon: 'remove-circle-outline', iconActive: 'remove-circle' },
  { rating: 'like', label: 'Like', icon: 'thumbs-up-outline', iconActive: 'thumbs-up' },
];

type Section = 'about' | 'muscles' | 'howto';
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'about', label: 'About' },
  { value: 'muscles', label: 'Muscles' },
  { value: 'howto', label: 'How to' },
];

const SECONDARY_COLOR = '#8A3A26';
/** How long each position shows while the how-to images play as a loop. */
const FRAME_MS = 1200;

function listLabel(values: string[] | null | undefined): string {
  return (values ?? []).join(', ');
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: exercise, isLoading } = useExercise(id);
  const [section, setSection] = useState<Section>('about');

  if (isLoading || !exercise) {
    return (
      <ScreenContainer>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.titleBlock}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Text style={styles.meta}>
          {[listLabel(exercise.muscle_groups), exercise.equipment, exercise.difficulty].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {SECTIONS.map((s) => {
          const active = section === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => setSection(s.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'about' ? <AboutSection exercise={exercise} /> : null}
      {section === 'muscles' ? <MusclesSection exercise={exercise} /> : null}
      {section === 'howto' ? <HowToSection exercise={exercise} /> : null}
    </ScreenContainer>
  );
}

function AboutSection({ exercise }: { exercise: Exercise }) {
  const { data: feedbackMap } = useExerciseFeedbackMap();
  const setFeedback = useSetExerciseFeedback();
  const currentFeedback = feedbackMap?.[exercise.id];
  const facts = [
    { label: 'Type', value: exercise.category },
    { label: 'Equipment', value: exercise.equipment },
    { label: 'Level', value: exercise.difficulty },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));

  return (
    <>
      {facts.length ? (
        <View style={styles.facts}>
          {facts.map((f) => (
            <Card key={f.label} style={styles.fact}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {f.value}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Instructions</Text>
        {exercise.instructions.length ? (
          exercise.instructions.map((step, index) => (
            <View key={index} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.bodyText}>No instructions for this exercise yet.</Text>
        )}
      </Card>

      <Card style={styles.feedbackCard}>
        <Text style={styles.cardTitle}>Include this in your plans?</Text>
        <Text style={styles.cardHint}>Liked exercises are favoured when your plan is generated; avoided ones are left out.</Text>
        <View style={styles.feedbackRow}>
          {FEEDBACK_OPTIONS.map((option) => {
            const active = currentFeedback === option.rating;
            return (
              <Pressable
                key={option.rating}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFeedback.mutate({ exerciseId: exercise.id, rating: option.rating })}
                style={[styles.feedbackButton, active && styles.feedbackButtonActive]}
              >
                <Ionicons
                  name={active ? option.iconActive : option.icon}
                  size={18}
                  color={active ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.feedbackLabel, active && styles.feedbackLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </>
  );
}

function MusclesSection({ exercise }: { exercise: Exercise }) {
  const fills = useMemo(
    () => muscleFills(exercise.muscle_groups, exercise.secondary_muscle_groups ?? [], colors.primary, SECONDARY_COLOR),
    [exercise.muscle_groups, exercise.secondary_muscle_groups]
  );
  const secondary = listLabel(exercise.secondary_muscle_groups);

  return (
    <Card style={styles.musclesCard}>
      <View
        style={styles.bodies}
        accessible
        accessibilityLabel={`Muscle map. Primary: ${listLabel(exercise.muscle_groups)}.${secondary ? ` Secondary: ${secondary}.` : ''}`}
      >
        {(['front', 'back'] as const).map((side) => (
          <View key={side} style={styles.bodyColumn}>
            <MuscleMap side={side} fills={fills} height={250} />
            <Text style={styles.bodyLabel}>{side === 'front' ? 'Front' : 'Back'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.legendRow}>
        <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
        <View style={styles.flex}>
          <Text style={styles.legendTitle}>Primary</Text>
          <Text style={styles.bodyText}>{listLabel(exercise.muscle_groups) || '—'}</Text>
        </View>
      </View>
      {secondary ? (
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: SECONDARY_COLOR }]} />
          <View style={styles.flex}>
            <Text style={styles.legendTitle}>Secondary</Text>
            <Text style={styles.bodyText}>{secondary}</Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function HowToSection({ exercise }: { exercise: Exercise }) {
  const media = exercise.media_urls?.length ? exercise.media_urls : exercise.media_url ? [exercise.media_url] : [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(media.length > 1);

  // Two frames (start and end position) looped read like a short demo clip.
  useEffect(() => {
    if (!playing || media.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % media.length), FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, media.length]);

  const frameLabel =
    media.length === 2 ? (index === 0 ? 'Start position' : 'End position') : `Step ${index + 1} of ${media.length}`;
  const videoSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} exercise proper form`)}`;

  return (
    <>
      {media.length ? (
        <Card style={styles.mediaCard}>
          <View>
            <Image
              source={{ uri: media[index] }}
              style={styles.media}
              resizeMode="contain"
              accessibilityLabel={`${exercise.name}, ${frameLabel.toLowerCase()}`}
            />
            {media.length > 1 ? (
              <Pressable
                onPress={() => setPlaying((p) => !p)}
                accessibilityRole="button"
                accessibilityLabel={playing ? 'Pause demo' : 'Play demo'}
                style={styles.playButton}
              >
                <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
              </Pressable>
            ) : null}
          </View>
          {media.length > 1 ? (
            <>
              <Text style={styles.frameLabel}>{frameLabel}</Text>
              <View style={styles.thumbs}>
                {media.map((uri, i) => (
                  <Pressable
                    key={uri}
                    onPress={() => {
                      setPlaying(false);
                      setIndex(i);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={media.length === 2 ? (i === 0 ? 'Start position' : 'End position') : `Step ${i + 1}`}
                    accessibilityState={{ selected: i === index }}
                    style={[styles.thumb, i === index && styles.thumbActive]}
                  >
                    <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text style={styles.bodyText}>No images for this exercise yet.</Text>
        </Card>
      )}

      <Card style={styles.videoCard}>
        <Ionicons name="logo-youtube" size={28} color={colors.danger} />
        <View style={styles.flex}>
          <Text style={styles.legendTitle}>Watch a video</Text>
          <Text style={styles.plainText}>Opens YouTube search results for this exercise's form.</Text>
        </View>
        <Button label="Watch" size="small" variant="secondary" onPress={() => Linking.openURL(videoSearch)} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  titleBlock: { gap: 2 },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
    cursor: 'pointer',
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  facts: { flexDirection: 'row', gap: spacing.sm },
  fact: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm + 4, gap: 2 },
  factLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  factValue: { color: colors.text, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -spacing.xs,
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  plainText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  step: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  stepText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  feedbackCard: {
    gap: spacing.sm,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  feedbackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    cursor: 'pointer',
  },
  feedbackLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackLabelActive: {
    color: colors.text,
  },
  feedbackButtonActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  musclesCard: { gap: spacing.md },
  bodies: { flexDirection: 'row', justifyContent: 'space-around' },
  bodyColumn: { alignItems: 'center', gap: spacing.xs },
  bodyLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  swatch: { width: 14, height: 14, borderRadius: 4, marginTop: 3 },
  legendTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  mediaCard: { gap: spacing.sm },
  media: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 420,
    borderRadius: radii.md,
    backgroundColor: '#fff',
  },
  playButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  frameLabel: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  thumbs: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  thumb: {
    width: 72,
    height: 54,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    cursor: 'pointer',
  },
  thumbActive: { borderColor: colors.primary },
  thumbImage: { width: '100%', height: '100%' },
  videoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
