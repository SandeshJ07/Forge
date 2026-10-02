import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Measurement } from '@/types/database';
import { formatDay } from '@/lib/format';
import { formatMeasurement } from '@/lib/measurementUnits';
import { colors, spacing } from '@/constants/theme';

interface MeasurementChartProps {
  measurements: Measurement[];
  unit: string;
  /** What's measured, for the y-axis title, e.g. "Body weight". */
  label: string;
  /** Target in `unit`, drawn as a dashed baseline. */
  target?: number | null;
  /** Start of the shown period (epoch ms); the x-axis then runs from here to today. Omit to fit the entries. */
  rangeStart?: number | null;
  /** Shown instead of the chart when there are no entries to plot. */
  emptyText?: string;
  /** e.g. "in the last 15 days" — how the change since the first shown entry is described. */
  periodPhrase?: string;
  /** Top-right of the header, e.g. the period picker. */
  headerRight?: ReactNode;
}

const HEIGHT = 220;
const PAD = { top: 22, right: 14, bottom: 30, left: 46 };
const DAY_MS = 86_400_000;
// SVG text doesn't inherit the app's font; on the web it would fall back to a serif.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

/** "2026-09-24" is a calendar day: parse it as local midnight, not UTC. */
function dayMs(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** About `count` evenly spaced, round-numbered ticks covering [min, max]. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A measurement's trend: the latest value and change over the period, then a dated line chart with labelled axes and the target as a baseline. */
export function MeasurementChart({
  measurements,
  unit,
  label,
  target,
  rangeStart,
  emptyText,
  periodPhrase,
  headerRight,
}: MeasurementChartProps) {
  const [width, setWidth] = useState(0);
  const chartRef = useRef<View>(null);
  // On the web, onLayout can miss the first measurement, leaving the chart blank; read the
  // box directly after each render as well (a View's ref is its DOM element there).
  useLayoutEffect(() => {
    const node = chartRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
    const measured = node?.getBoundingClientRect?.().width;
    if (measured && Math.round(measured) !== Math.round(width)) setWidth(measured);
  });

  if (!measurements.length) {
    return (
      <View>
        {headerRight ? <View style={styles.headerRightOnly}>{headerRight}</View> : null}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyText ?? 'No entries yet. Add your first one below to start tracking.'}</Text>
        </View>
      </View>
    );
  }

  const values = measurements.map((m) => m.value);
  const latest = measurements[measurements.length - 1];
  const first = measurements[0];
  const change = latest.value - first.value;
  const toGo = target != null ? target - latest.value : null;

  // Scales: x by date, y over the values and the target, with a little headroom.
  const xs = measurements.map((m) => dayMs(m.date));
  const today = new Date();
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // With a chosen period the axis shows all of it, up to today; otherwise it fits the entries.
  let xMin = rangeStart != null ? Math.min(rangeStart, ...xs) : Math.min(...xs);
  let xMax = rangeStart != null ? Math.max(todayMs, ...xs) : Math.max(...xs);
  if (xMax === xMin) {
    xMin -= DAY_MS;
    xMax += DAY_MS;
  }
  const yValues = target != null ? [...values, target] : values;
  const rawMin = Math.min(...yValues);
  const rawMax = Math.max(...yValues);
  const headroom = (rawMax - rawMin || Math.max(1, rawMax * 0.05)) * 0.12;
  const yTicks = niceTicks(rawMin - headroom, rawMax + headroom);
  const yMin = Math.min(rawMin - headroom, yTicks[0]);
  const yMax = Math.max(rawMax + headroom, yTicks[yTicks.length - 1]);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (ms: number) => PAD.left + ((ms - xMin) / (xMax - xMin)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const xTickCount = Math.min(4, Math.max(2, measurements.length));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => xMin + ((xMax - xMin) * i) / (xTickCount - 1));
  const linePath = measurements.map((m, i) => `${i ? 'L' : 'M'}${x(dayMs(m.date))},${y(m.value)}`).join(' ');
  const showDots = measurements.length <= 40;

  const summary =
    `${label}: latest ${formatMeasurement(latest.value)} ${unit} on ${formatDay(latest.date)}, ` +
    `${change >= 0 ? 'up' : 'down'} ${formatMeasurement(Math.abs(change))} ${unit} since ${formatDay(first.date)}` +
    (target != null ? `. Target ${formatMeasurement(target)} ${unit}.` : '.');

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.latest}>
            {formatMeasurement(latest.value)} <Text style={styles.latestUnit}>{unit}</Text>
          </Text>
          <Text style={styles.summary}>
            {measurements.length > 1
              ? `${change > 0 ? '+' : change < 0 ? '−' : '±'}${formatMeasurement(Math.abs(change))} ${unit} ${periodPhrase ?? `since ${formatDay(first.date)}`}`
              : `On ${formatDay(latest.date)}`}
            {target != null && toGo != null ? (
              <Text style={styles.summaryTarget}>
                {' · '}
                {Math.abs(toGo) < 0.05 ? 'Target reached 🎉' : `${formatMeasurement(Math.abs(toGo))} ${unit} to target`}
              </Text>
            ) : null}
          </Text>
        </View>
        {headerRight}
      </View>

      <View
        ref={chartRef}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={summary}
      >
        {width ? (
          <Svg width={width} height={HEIGHT}>
            {/* Y axis title */}
            <SvgText fontFamily={FONT} x={PAD.left - 38} y={12} fill={colors.textMuted} fontSize={11} fontWeight="600">
              {`${label} (${unit})`}
            </SvgText>

            {/* Horizontal gridlines + y tick labels */}
            {yTicks.map((t) => (
              <G key={`y${t}`}>
                <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
                <SvgText fontFamily={FONT} x={PAD.left - 6} y={y(t) + 4} fill={colors.textMuted} fontSize={10} textAnchor="end">
                  {formatMeasurement(t)}
                </SvgText>
              </G>
            ))}

            {/* Axes */}
            <Line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.textMuted} strokeWidth={1} />
            <Line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke={colors.textMuted} strokeWidth={1} />

            {/* X tick labels */}
            {xTicks.map((t, i) => (
              <SvgText fontFamily={FONT}
                key={`x${i}`}
                x={x(t)}
                y={PAD.top + plotH + 14}
                fill={colors.textMuted}
                fontSize={10}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              >
                {shortDate(t)}
              </SvgText>
            ))}
            {/* X axis title */}
            <SvgText fontFamily={FONT} x={PAD.left + plotW / 2} y={HEIGHT - 2} fill={colors.textMuted} fontSize={11} fontWeight="600" textAnchor="middle">
              Date
            </SvgText>

            {/* Target baseline */}
            {target != null ? (
              <G>
                <Line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={y(target)}
                  y2={y(target)}
                  stroke={colors.success}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                <SvgText fontFamily={FONT}
                  x={PAD.left + plotW - 2}
                  y={y(target) - 5}
                  fill={colors.success}
                  fontSize={11}
                  fontWeight="700"
                  textAnchor="end"
                >
                  {`Target ${formatMeasurement(target)} ${unit}`}
                </SvgText>
              </G>
            ) : null}

            {/* The measurements */}
            {measurements.length > 1 ? (
              <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {showDots
              ? measurements.map((m, i) => (
                  <Circle
                    key={m.id}
                    cx={x(dayMs(m.date))}
                    cy={y(m.value)}
                    r={i === measurements.length - 1 ? 4.5 : 3}
                    fill={i === measurements.length - 1 ? colors.primary : colors.surface}
                    stroke={colors.primary}
                    strokeWidth={1.5}
                  />
                ))
              : null}
          </Svg>
        ) : (
          <View style={{ height: HEIGHT }} />
        )}
      </View>
      {measurements.length === 1 ? (
        <Text style={styles.hint}>Add another entry to see your trend.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  headerRightOnly: { alignItems: 'flex-end' },
  latest: { color: colors.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  latestUnit: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  // Neutral on purpose: whether "up" is good depends on the goal and the measurement.
  summary: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  summaryTarget: { color: colors.success, fontWeight: '700' },
});
