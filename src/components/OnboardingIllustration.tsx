import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/constants/theme';

export type OnboardingIllustrationName =
  | 'units'
  | 'profile'
  | 'goal'
  | 'experience'
  | 'equipment'
  | 'schedule'
  | 'ai';

interface IllustrationProps {
  size?: number;
}

/**
 * Flat single-tone gym silhouettes, one per onboarding step. Drawn in the
 * same style as LogoMark (solid fills, no outlines/gradients) so they read
 * as part of the same visual system rather than borrowed stock art.
 */
export function OnboardingIllustration({ name, size = 96 }: { name: OnboardingIllustrationName } & IllustrationProps) {
  switch (name) {
    case 'units':
      return <RulerIllustration size={size} />;
    case 'profile':
      return <FigureIllustration size={size} />;
    case 'goal':
      return <TargetIllustration size={size} />;
    case 'experience':
      return <BarbellIllustration size={size} />;
    case 'equipment':
      return <DumbbellRackIllustration size={size} />;
    case 'schedule':
      return <CalendarIllustration size={size} />;
    case 'ai':
      return <SparkIllustration size={size} />;
    default:
      return null;
  }
}

function RulerIllustration({ size }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Rect x="14" y="34" width="68" height="28" rx="4" fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={2} />
      <Path
        d="M22 34 V44 M32 34 V40 M42 34 V44 M52 34 V40 M62 34 V44 M72 34 V40"
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function FigureIllustration({ size }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Circle cx="48" cy="26" r="12" fill={colors.primary} />
      <Path
        d="M48 40 C 34 40, 26 50, 26 64 V 76 H 70 V 64 C 70 50, 62 40, 48 40 Z"
        fill={colors.surfaceAlt}
        stroke={colors.border}
        strokeWidth={2}
      />
      <Path d="M20 54 L 26 64 M76 54 L 70 64" stroke={colors.primary} strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

function TargetIllustration({ size }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Circle cx="48" cy="48" r="30" fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={2} />
      <Circle cx="48" cy="48" r="18" fill={colors.background} stroke={colors.border} strokeWidth={2} />
      <Circle cx="48" cy="48" r="7" fill={colors.primary} />
    </Svg>
  );
}

function BarbellIllustration({ size }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Rect x="16" y="44" width="8" height="20" rx="2" fill={colors.primary} />
      <Rect x="26" y="40" width="6" height="28" rx="2" fill={colors.warning} />
      <Rect x="34" y="46" width="28" height="4" fill={colors.textMuted} />
      <Rect x="64" y="40" width="6" height="28" rx="2" fill={colors.warning} />
      <Rect x="72" y="44" width="8" height="20" rx="2" fill={colors.primary} />
    </Svg>
  );
}

function DumbbellRackIllustration({ size }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Rect x="16" y="66" width="64" height="6" rx="2" fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={2} />
      <Rect x="24" y="34" width="8" height="32" rx="3" fill={colors.primary} />
      <Circle cx="28" cy="34" r="9" fill={colors.warning} />
      <Rect x="44" y="40" width="8" height="26" rx="3" fill={colors.primary} />
      <Circle cx="48" cy="40" r="7" fill={colors.warning} />
      <Rect x="62" y="30" width="8" height="36" rx="3" fill={colors.primary} />
      <Circle cx="66" cy="30" r="10" fill={colors.warning} />
    </Svg>
  );
}

function CalendarIllustration({ size }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Rect x="18" y="24" width="60" height="52" rx="6" fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={2} />
      <Path d="M18 38 H78" stroke={colors.border} strokeWidth={2} />
      <Path d="M30 18 V30 M66 18 V30" stroke={colors.primary} strokeWidth={4} strokeLinecap="round" />
      <Rect x="28" y="46" width="10" height="10" rx="2" fill={colors.primary} />
      <Rect x="43" y="46" width="10" height="10" rx="2" fill={colors.border} />
      <Rect x="58" y="46" width="10" height="10" rx="2" fill={colors.border} />
      <Rect x="28" y="60" width="10" height="10" rx="2" fill={colors.border} />
      <Rect x="43" y="60" width="10" height="10" rx="2" fill={colors.warning} />
    </Svg>
  );
}

function SparkIllustration({ size }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Path
        d="M48 16 L56 40 L80 48 L56 56 L48 80 L40 56 L16 48 L40 40 Z"
        fill={colors.primary}
      />
      <Circle cx="74" cy="24" r="4" fill={colors.warning} />
      <Circle cx="20" cy="70" r="3" fill={colors.warning} />
    </Svg>
  );
}
