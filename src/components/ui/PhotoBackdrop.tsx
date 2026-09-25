import type { ReactNode } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/constants/theme';

interface PhotoBackdropProps {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  /** Where the photo fades into the app background: 'bottom' for stacked (phone) layouts, 'full' for text-over-photo panels. */
  fade?: 'bottom' | 'full';
  children?: ReactNode;
}

// [offset, opacity] stops: 'bottom' stays mostly clear then dissolves into the page;
// 'full' darkens the whole photo enough to carry text.
const SCRIMS: Record<'bottom' | 'full', [string, string][]> = {
  bottom: [
    ['0', '0.1'],
    ['0.7', '0.2'],
    ['1', '1'],
  ],
  full: [
    ['0', '0.55'],
    ['0.45', '0.35'],
    ['1', '0.95'],
  ],
};

/**
 * A cover-fit photo with a gradient scrim so it melts into the dark UI and
 * any text laid over it stays readable. The gradient is the only drawn
 * element — the imagery itself is real photography.
 */
export function PhotoBackdrop({ source, style, fade = 'bottom', children }: PhotoBackdropProps) {
  const gradientId = `scrim-${fade}`;
  return (
    <View style={[styles.container, style]}>
      <Image source={source} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {SCRIMS[fade].map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor={colors.background} stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photo: {
    // Explicit size, not just absoluteFill: react-native-web otherwise sizes a
    // bundled image to its intrinsic pixels (e.g. 960×640) and "cover" then
    // crops to the photo's top-left corner on small screens.
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
