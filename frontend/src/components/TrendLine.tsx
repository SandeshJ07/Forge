import { CartesianChart, Line } from 'victory-native';
import { colors } from '@/constants/theme';

export interface TrendLineProps {
  data: { x: number; y: number }[];
}

/** The Skia-drawn line itself. On web, only ever load this through LazyTrendLine. */
export default function TrendLine({ data }: TrendLineProps) {
  return (
    <CartesianChart data={data} xKey="x" yKeys={['y']}>
      {({ points }) => (
        <Line points={points.y} color={colors.primary} strokeWidth={3} animate={{ type: 'timing', duration: 300 }} />
      )}
    </CartesianChart>
  );
}
