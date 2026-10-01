import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '@/constants/theme';

interface RouteSvgProps {
  /** One or more [[lat, lng], ...] lines (a recording segment each). */
  segments: number[][][];
  width: number;
  height: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The route's shape, drawn to fit the box — no map tiles. Used for list
 * thumbnails, and as the map on platforms without an interactive one.
 */
export function RouteSvg({ segments, width, height, strokeWidth = 2.5, style }: RouteSvgProps) {
  const lines = useMemo(() => project(segments, width, height, strokeWidth * 2), [segments, width, height, strokeWidth]);
  if (!lines.length) return <View style={[{ width, height }, style]} />;
  const first = lines[0][0];
  const lastLine = lines[lines.length - 1];
  const last = lastLine[lastLine.length - 1];
  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        {lines.map((line, i) => (
          <Polyline
            key={i}
            points={line.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <Circle cx={first[0]} cy={first[1]} r={strokeWidth * 1.4} fill={colors.success} />
        <Circle cx={last[0]} cy={last[1]} r={strokeWidth * 1.4} fill={colors.text} />
      </Svg>
    </View>
  );
}

/** Lat/lng → box pixels, keeping the route's aspect ratio (longitude scaled by latitude). */
function project(segments: number[][][], width: number, height: number, pad: number): number[][][] {
  const all = segments.flat();
  if (all.length < 2) return [];
  const midLat = all.reduce((s, p) => s + p[0], 0) / all.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = all.map((p) => p[1] * k);
  const ys = all.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return segments
    .filter((s) => s.length)
    .map((s) => s.map(([lat, lng]) => [offX + (lng * k - minX) * scale, offY + (maxY - lat) * scale]));
}
