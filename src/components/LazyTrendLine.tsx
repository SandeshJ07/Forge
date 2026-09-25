import TrendLine, { type TrendLineProps } from '@/components/TrendLine';

/** Native builds bundle Skia directly, so no lazy loading is needed. See LazyTrendLine.web.tsx. */
export function LazyTrendLine(props: TrendLineProps) {
  return <TrendLine {...props} />;
}
