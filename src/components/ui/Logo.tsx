import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '@/constants/theme';

interface LogoMarkProps {
  size?: number;
}

/** The Forge mark: a flame rising off an anvil. */
export function LogoMark({ size = 32 }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Path
        d="M100 22 C 108 40, 122 46, 122 66 C 122 80, 112 88, 100 88 C 88 88, 78 80, 78 66 C 78 56, 84 52, 86 44 C 90 54, 96 54, 94 42 C 93 34, 96 26, 100 22 Z"
        fill={colors.primary}
      />
      <Path
        d="M100 52 C 104 58, 108 62, 108 68 C 108 74, 104 78, 100 78 C 96 78, 92 74, 92 68 C 92 64, 95 61, 97 57 C 98 62, 101 61, 100 52 Z"
        fill={colors.warning}
      />
      <Path
        d="M58 96 H 142 C 146 96, 148 99, 146 103 L 138 116 C 137 118, 135 119, 133 119 H 118 V 130 H 128 C 132 130, 135 133, 135 137 V 142 H 65 V 137 C 65 133, 68 130, 72 130 H 82 V 119 H 67 C 65 119, 63 118, 62 116 L 54 103 C 52 99, 54 96, 58 96 Z"
        fill={colors.text}
      />
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
