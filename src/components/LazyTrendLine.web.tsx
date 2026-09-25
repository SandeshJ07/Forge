import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import type { TrendLineProps } from '@/components/TrendLine';
import { colors } from '@/constants/theme';

/**
 * Skia on web runs on CanvasKit (WebAssembly). Skia's JS API binds to
 * CanvasKit when its module is first evaluated, so the chart code must not
 * even be *imported* until CanvasKit has loaded — rendering later isn't
 * enough. WithSkiaWeb loads the .wasm, then dynamically imports the chart.
 * The .wasm is served from public/ (copied there by
 * `node node_modules/@shopify/react-native-skia/scripts/setup-canvaskit.js`).
 */
export function LazyTrendLine(props: TrendLineProps) {
  return (
    <WithSkiaWeb
      opts={{ locateFile: () => '/canvaskit.wasm' }}
      getComponent={() => import('@/components/TrendLine')}
      componentProps={props}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
