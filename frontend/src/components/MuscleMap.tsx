import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';
import type { BodyPart, Slug } from 'react-native-body-highlighter';
import { bodyFront } from 'react-native-body-highlighter/dist/assets/bodyFront';
import { bodyBack } from 'react-native-body-highlighter/dist/assets/bodyBack';
import { colors } from '@/constants/theme';

// Body outlines from react-native-body-highlighter (MIT). Drawn here rather
// than with its <Body> component, which passes onPress/accessible straight
// through to the DOM on web and floods dev with React warnings.
/** Untrained regions: a step lighter than the card so the silhouette reads on the dark theme. */
const BODY_FILL = '#343B45';

const ASSETS: Record<'front' | 'back', { parts: BodyPart[]; viewBox: string }> = {
  front: { parts: bodyFront, viewBox: '0 0 724 1448' },
  back: { parts: bodyBack, viewBox: '724 0 724 1448' },
};

interface MuscleMapProps {
  side: 'front' | 'back';
  /** Fill per highlighted region; everything else is drawn in the neutral body color. */
  fills: Partial<Record<Slug, string>>;
  height: number;
}

export const MuscleMap = memo(function MuscleMap({ side, fills, height }: MuscleMapProps) {
  const { parts, viewBox } = ASSETS[side];
  return (
    <Svg viewBox={viewBox} height={height} width={height / 2}>
      {parts.flatMap((part) => {
        const fill = (part.slug && fills[part.slug]) || BODY_FILL;
        const paths = [...(part.path?.common ?? []), ...(part.path?.left ?? []), ...(part.path?.right ?? [])];
        return paths.map((d) => <Path key={d} d={d} fill={fill} stroke={colors.surface} strokeWidth={1} />);
      })}
    </Svg>
  );
});
