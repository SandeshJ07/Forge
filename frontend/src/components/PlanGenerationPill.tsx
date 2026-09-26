import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlanGeneration } from '@/hooks/usePlans';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { colors, radii, spacing } from '@/constants/theme';

const READY_AUTO_HIDE_MS = 10000;
const TAB_BAR_HEIGHT = 58;

/**
 * Floating status for background plan generation, visible on every signed-in
 * screen: "Building your exercise groups…" while it runs, then "ready → View" or the
 * error with "Try again". Ready/failed only announce a job this session saw
 * start, so an old result never pops up on a fresh launch (the Plan tab shows it).
 */
export function PlanGenerationPill() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const { data } = usePlanGeneration();

  const watchedJobId = useRef<string | null>(null);
  const [dismissedJobId, setDismissedJobId] = useState<string | null>(null);

  const status = data?.status ?? 'idle';
  const jobId = data?.plan_id ?? null;
  if (status === 'generating' && jobId) watchedJobId.current = jobId;
  const isWatched = jobId !== null && watchedJobId.current === jobId;

  useEffect(() => {
    if (status !== 'ready' || !jobId) return;
    const timer = setTimeout(() => setDismissedJobId(jobId), READY_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [status, jobId]);

  // The Plan tab and the review screen show a finished plan themselves.
  const onPlanScreen = pathname === '/plan' || pathname.startsWith('/plan/review');
  const visible =
    jobId !== null &&
    jobId !== dismissedJobId &&
    !pathname.startsWith('/plan/new') &&
    (status === 'generating' || (isWatched && (status === 'failed' || (status === 'ready' && !onPlanScreen))));
  if (!visible) return null;

  const dismiss = () => setDismissedJobId(jobId);
  const position = isDesktopWeb
    ? { right: spacing.xl, bottom: spacing.xl }
    : { left: spacing.md, right: spacing.md, bottom: TAB_BAR_HEIGHT + insets.bottom + spacing.sm };

  return (
    <View style={[styles.pill, position]} pointerEvents="box-none" accessibilityLiveRegion="polite">
      {status === 'generating' ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <View style={styles.text}>
            <Text style={styles.title}>Building your exercise groups…</Text>
            <Text style={styles.body}>Keep exploring — we'll let you know when it's ready.</Text>
          </View>
        </>
      ) : status === 'ready' ? (
        <>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <View style={styles.text}>
            <Text style={styles.title}>Your new plan is ready</Text>
            <Text style={styles.body}>Review it before it replaces your current one.</Text>
          </View>
          <Pressable
            onPress={() => {
              dismiss();
              router.navigate('/plan/review');
            }}
            style={styles.action}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Review</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Ionicons name="alert-circle" size={24} color={colors.danger} />
          <View style={styles.text}>
            <Text style={styles.title}>Couldn't build your exercise groups</Text>
            <Text style={styles.body} numberOfLines={2}>
              {data?.error ?? 'Please try again.'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              dismiss();
              router.push('/plan/new');
            }}
            style={styles.action}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Try again</Text>
          </Pressable>
        </>
      )}
      {status !== 'generating' ? (
        <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss" style={styles.close}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  action: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    cursor: 'pointer',
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  close: {
    padding: 2,
    cursor: 'pointer',
  },
});
