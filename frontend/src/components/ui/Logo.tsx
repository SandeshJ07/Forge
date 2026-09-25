import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { colors, spacing } from '@/constants/theme';

interface LogoMarkProps {
  size?: number;
}

const HANDLE = 'M52 106 C42 80 44 46 70 34 C84 27 116 27 130 34 C156 46 158 80 148 106';
const BELL = 'M100 66 C135 66 162 93 162 128 C162 149 155 164 145 176 H55 C45 164 38 149 38 128 C38 93 65 66 100 66 Z';
const FLAME =
  'M100 22 C 108 40, 122 46, 122 66 C 122 80, 112 88, 100 88 C 88 88, 78 80, 78 66 C 78 56, 84 52, 86 44 C 90 54, 96 54, 94 42 C 93 34, 96 26, 100 22 Z';
const FLAME_CORE =
  'M100 52 C 104 58, 108 62, 108 68 C 108 74, 104 78, 100 78 C 96 78, 92 74, 92 68 C 92 64, 95 61, 97 57 C 98 62, 101 61, 100 52 Z';

/**
 * The Forge mark: a kettlebell with a flame forged into it. Same drawing as
 * assets/logo/forge-mark.svg, which the app icons and favicon are made from.
 */
export function LogoMark({ size = 32 }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="25 23 150 156">
      <Path d={HANDLE} fill="none" stroke={colors.primary} strokeWidth={17} strokeLinecap="round" />
      <Path d={BELL} fill={colors.primary} />
      <G transform="translate(100 128) scale(1.3) translate(-100 -56)">
        <Path d={FLAME} fill={colors.background} />
        <Path d={FLAME_CORE} fill={colors.warning} />
      </G>
    </Svg>
  );
}

interface LogoProps extends LogoMarkProps {
  wordmark?: boolean;
  textSize?: number;
}

/** Mark + "Forge" wordmark, used in nav chrome and the sign-in screen. */
export function Logo({ size = 32, wordmark = true, textSize = 20 }: LogoProps) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      {wordmark ? <Text style={[styles.wordmark, { fontSize: textSize }]}>Forge</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    color: colors.text,
    fontWeight: '800',
  },
});
