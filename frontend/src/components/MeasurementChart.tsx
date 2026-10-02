import { useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Measurement } from '@/types/database';
import { formatDay } from '@/lib/format';
import { formatMeasurement } from '@/lib/measurementUnits';
import { colors, radii, spacing } from '@/constants/theme';

interface MeasurementChartProps {
  measurements: Measurement[];
  unit: string;
  /** What's measured, for the y-axis title, e.g. "Body weight". */
  label: string;
  /** Target in `unit`, drawn as a dashed baseline. */
  target?: number | null;
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

/** A measurement's trend: headline metrics, then a dated line chart with labelled axes and the target as a baseline. */
export function MeasurementChart({ measurements, unit, label, target }: MeasurementChartProps) {
  const [width, setWidth] = useState(0);

  if (!measurements.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No entries yet. Add your first one below to start tracking.</Text>
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
  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
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
      <View style={styles.metrics}>
        <Metric label="Latest" value={`${formatMeasurement(latest.value)} ${unit}`} hint={formatDay(latest.date)} />
        <Metric
          label="Change"
          value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${formatMeasurement(Math.abs(change))} ${unit}`}
          hint={`since ${formatDay(first.date)}`}
        />
        <Metric label="Lowest" value={`${formatMeasurement(Math.min(...values))} ${unit}`} />
        <Metric label="Highest" value={`${formatMeasurement(Math.max(...values))} ${unit}`} />
        {target != null && toGo != null ? (
          <Metric
            label="To target"
            value={Math.abs(toGo) < 0.05 ? 'Reached 🎉' : `${toGo > 0 ? '+' : '−'}${formatMeasurement(Math.abs(toGo))} ${unit}`}
            hint={`target ${formatMeasurement(target)} ${unit}`}
            highlight
          />
        ) : null}
      </View>

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={summary}>
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

function Metric({ label, value, hint, highlight = false }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <View style={[styles.metric, highlight && styles.metricHighlight]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, highlight && styles.metricValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.metricHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metric: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 90,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    gap: 1,
  },
  metricHighlight: { borderWidth: 1, borderColor: colors.success },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  // Neutral on purpose: whether "up" is good depends on the goal and the measurement.
  metricValue: { color: colors.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricValueHighlight: { color: colors.success },
  metricHint: { color: colors.textMuted, fontSize: 11 },
});
