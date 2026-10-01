import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { RouteSvg } from '@/components/RouteSvg';
import { colors, radii } from '@/constants/theme';

export interface RouteMapProps {
  /** [[lat, lng], ...] per recording segment. */
  segments: number[][][];
  height: number;
  /** Live recording: keep the view on the latest point instead of fitting the whole route. */
  follow?: boolean;
}

/**
 * Native: the route's outline without map tiles, until an interactive native
 * map is added with the phone app's run recording. The web version
 * (RouteMap.web.tsx) shows an OpenStreetMap map.
 */
export function RouteMap({ segments, height }: RouteMapProps) {
  const [width, setWidth] = useState(0);
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      {width ? <RouteSvg segments={segments} width={width} height={height} strokeWidth={3.5} /> : null}
    </View>
  );
}
