import { StyleSheet, View } from 'react-native';
import { colors, radii } from '@/constants/theme';

export function OnboardingProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
});
