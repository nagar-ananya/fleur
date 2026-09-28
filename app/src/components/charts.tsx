/**
 * Charts, hand-rolled on react-native-svg (REQUIREMENTS §5.1, §11).
 *
 * §11.5 applies throughout: no red, no alarm iconography, and colour never
 * carries meaning on its own — every band, direction and state is paired with
 * a text label or an accessibility label.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import { radius, severityWord, spacing, type Gradient, type Palette } from '../theme';
import { formatShort } from '../utils/dates';
import { GradientFill } from './gradient';
import { PressableScale } from './motion';
import { Txt } from './primitives';

// --------------------------------------------------------------------------
// Trend
// --------------------------------------------------------------------------

export interface TrendPoint {
  date: string;
  value: number | null;
}

/**
 * Severity over time, as a line with a gradient wash beneath it.
 *
 * Gaps stay gaps: consecutive logged days are joined, missing days break the
 * line rather than being bridged by one that implies data we do not have.
 */
/** Nearest sample to a touch, for the scrubber. Pure, so it is testable. */
export function nearestIndex(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0;
  const step = width / (count - 1);
  return Math.min(count - 1, Math.max(0, Math.round(x / step)));
}

export function TrendChart({
  points,
  height = 96,
  max = 10,
  gradient,
  showDots = true,
  interactive = false,
}: {
  points: readonly TrendPoint[];
  height?: number;
  max?: number;
  gradient?: Gradient;
  showDots?: boolean;
  /** Touch or drag to read individual days; the reading persists after release. */
  interactive?: boolean;
}): React.ReactElement {
  const { palette } = useTheme();
  const [width, setWidth] = React.useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const fillId = useId().replace(/:/g, '');
  const lineId = useId().replace(/:/g, '');
  const ramp = gradient ?? palette.gradients.trend;

  // Room above the line for the readout when the chart is interactive.
  const top = interactive ? 34 : 10;
  const bottom = height - 14;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const yFor = (value: number): number => bottom - (value / max) * (bottom - top);

  const widthRef = useRef(0);
  const countRef = useRef(points.length);
  countRef.current = points.length;
  const selectedRef = useRef<number | null>(null);

  const responder = useMemo(() => {
    const scrub = (x: number): void => {
      const index = nearestIndex(x, widthRef.current, countRef.current);
      if (index !== selectedRef.current) {
        selectedRef.current = index;
        setSelected(index);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => interactive,
      onMoveShouldSetPanResponder: () => interactive,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => scrub(event.nativeEvent.locationX),
      onPanResponderMove: (event) => scrub(event.nativeEvent.locationX),
    });
  }, [interactive]);

  // A new data window invalidates the selection. Keyed on content, not array
  // identity: callers map fresh arrays on every render, and an identity key
  // would reset the selection in response to the very re-render selecting
  // something causes.
  const signature = points.map((p) => `${p.date}:${p.value ?? ''}`).join('|');
  useEffect(() => {
    selectedRef.current = null;
    setSelected(null);
  }, [signature]);

  const { segments, areas, dots } = useMemo(() => {
    const segs: string[] = [];
    const ars: string[] = [];
    const ds: { x: number; y: number; last: boolean }[] = [];
    let line = '';
    let area = '';
    let startX = 0;

    points.forEach((point, index) => {
      const x = index * step;
      if (point.value === null) {
        if (line) {
          segs.push(line);
          ars.push(`${area} L ${x - step} ${bottom} L ${startX} ${bottom} Z`);
        }
        line = '';
        area = '';
        return;
      }
      const y = yFor(point.value);
      if (!line) {
        line = `M ${x} ${y}`;
        area = `M ${x} ${y}`;
        startX = x;
      } else {
        line += ` L ${x} ${y}`;
        area += ` L ${x} ${y}`;
      }
      ds.push({ x, y, last: index === points.length - 1 });
    });

    if (line) {
      const endX = (points.length - 1) * step;
      segs.push(line);
      ars.push(`${area} L ${endX} ${bottom} L ${startX} ${bottom} Z`);
    }
    return { segments: segs, areas: ars, dots: ds };
  }, [points, step, bottom, top, max, width]);

  const active = selected !== null && selected < points.length ? points[selected] : null;
  const activeX = selected !== null ? selected * step : 0;
  const tooltipWidth = 132;
  const tooltipLeft = Math.min(Math.max(activeX - tooltipWidth / 2, 0), Math.max(width - tooltipWidth, 0));

  return (
    <View
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      style={{ height }}
      {...(interactive ? responder.panHandlers : {})}
      accessibilityLabel={
        active
          ? `${formatShort(active.date)}: ${
              active.value === null ? 'no entry' : `severity ${active.value}, ${severityWord(active.value)}`
            }`
          : undefined
      }
    >
      {width > 0 ? (
        <Svg width={width} height={height} pointerEvents="none">
          <Defs>
            <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={ramp.from} stopOpacity={0.32} />
              <Stop offset="1" stopColor={ramp.from} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={ramp.from} />
              <Stop offset="1" stopColor={ramp.to} />
            </LinearGradient>
          </Defs>

          {areas.map((d, i) => (
            <Path key={`a${i}`} d={d} fill={`url(#${fillId})`} />
          ))}
          {segments.map((d, i) => (
            <Path
              key={`s${i}`}
              d={d}
              stroke={`url(#${lineId})`}
              strokeWidth={2.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {showDots
            ? dots.map((dot, i) => (
                <Circle
                  key={`d${i}`}
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.last ? 5 : 2.6}
                  fill={dot.last ? ramp.to : palette.surface}
                  stroke={ramp.to}
                  strokeWidth={dot.last ? 0 : 2}
                />
              ))
            : null}

          {/* Scrubber: a dashed guide line down to the axis and a ring on the sample. */}
          {active ? (
            <G>
              <Line
                x1={activeX}
                y1={top - 6}
                x2={activeX}
                y2={bottom}
                stroke={palette.borderStrong}
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
              {active.value !== null ? (
                <>
                  <Circle cx={activeX} cy={yFor(active.value)} r={9} fill={ramp.to} opacity={0.18} />
                  <Circle
                    cx={activeX}
                    cy={yFor(active.value)}
                    r={5}
                    fill={palette.surface}
                    stroke={ramp.to}
                    strokeWidth={2.4}
                  />
                </>
              ) : null}
            </G>
          ) : null}
        </Svg>
      ) : null}

      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: tooltipLeft,
            width: tooltipWidth,
            alignItems: 'center',
            backgroundColor: palette.surfaceAlt,
            borderRadius: radius.sm,
            paddingVertical: 4,
            paddingHorizontal: spacing.sm,
          }}
        >
          <Txt variant="micro" tone="faint" style={{ textTransform: 'uppercase' }}>
            {formatShort(active.date)}
          </Txt>
          <Txt variant="label" style={{ color: active.value === null ? palette.textFaint : palette.text }}>
            {active.value === null ? 'No entry' : `${active.value} · ${severityWord(active.value)}`}
          </Txt>
        </View>
      ) : interactive ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 6, right: 0 }}>
          <Txt variant="caption" tone="faint">
            Touch to read a day
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** Fourteen cells showing which of the trailing days carry a check-in. */
export function DayRibbon({
  days,
  height = 34,
}: {
  days: readonly { date: string; logged: boolean }[];
  height?: number;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: 3, height }}
      accessibilityLabel={`${days.filter((d) => d.logged).length} of ${days.length} recent days logged`}
    >
      {days.map((day) => (
        <View
          key={day.date}
          style={{
            flex: 1,
            borderRadius: 4,
            backgroundColor: day.logged ? palette.primary : palette.surfaceAlt,
            opacity: day.logged ? 1 : 0.9,
          }}
        />
      ))}
    </View>
  );
}

// --------------------------------------------------------------------------
// Insights — diverging bars
// --------------------------------------------------------------------------

export interface FactorBar {
  name: string;
  label: string;
  value: number;
  direction: 'increases' | 'decreases';
}

/**
 * Coefficients as a diverging chart around a shared centre line.
 *
 * Left-aligned bars forced the reader to check a text label to learn which way
 * a factor pushed. Diverging from a centre makes direction structural — you
 * see it before you read it — while the words stay for anyone who cannot
 * distinguish the colours (§11.5).
 */
export function DivergingBars({
  bars,
  onSelect,
}: {
  bars: readonly FactorBar[];
  onSelect: (bar: FactorBar) => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const peak = Math.max(...bars.map((b) => Math.abs(b.value)), 1e-6);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt variant="micro" tone="faint" style={{ textTransform: 'uppercase' }}>
          ← lowers risk
        </Txt>
        <Txt variant="micro" tone="faint" style={{ textTransform: 'uppercase' }}>
          raises risk →
        </Txt>
      </View>

      {bars.map((bar) => {
        const raises = bar.direction === 'increases';
        const ratio = Math.abs(bar.value) / peak;
        const gradient = raises ? palette.gradients.high : palette.gradients.low;
        const tint = raises ? palette.bandHighText : palette.bandLowText;

        return (
          <PressableScale
            key={bar.name}
            onPress={() => onSelect(bar)}
            accessibilityLabel={`${bar.label}, ${raises ? 'raises risk' : 'lowers risk'}`}
            accessibilityHint="Opens an explanation of this factor"
            scaleTo={0.985}
            style={{ minHeight: 46, justifyContent: 'center' }}
          >
            {/* Direction sits inline with the label rather than on its own
                line. Which side of the centre a bar falls on already carries
                it structurally, and the row's accessibility label states it
                outright — so a third repetition only cost vertical rhythm. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginBottom: 7,
              }}
            >
              <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>
                {bar.label}
              </Txt>
              <Txt variant="caption" style={{ color: tint }}>
                {raises ? 'raises' : 'lowers'}
              </Txt>
            </View>
            <View style={{ height: 12, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                {!raises ? <Bar ratio={ratio} gradient={gradient} align="right" /> : null}
              </View>
              <View style={{ width: 1.5, height: 18, backgroundColor: palette.borderStrong }} />
              <View style={{ flex: 1 }}>
                {raises ? <Bar ratio={ratio} gradient={gradient} align="left" /> : null}
              </View>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Bar({
  ratio,
  gradient,
  align,
}: {
  ratio: number;
  gradient: Gradient;
  align: 'left' | 'right';
}): React.ReactElement {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(grow, {
      toValue: 1,
      duration: 640,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [grow]);

  const width = grow.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(ratio * 100, 4)}%`],
  });

  return (
    <Animated.View
      style={{
        width,
        height: 12,
        borderRadius: 6,
        overflow: 'hidden',
        alignSelf: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <GradientFill gradient={gradient} angle="horizontal" />
    </Animated.View>
  );
}

/**
 * Where a factor's effect typically lands, on a 0-21 day axis.
 *
 * §7.4 documents each trigger's latency and Fleur caps its lookback at
 * 14 days. Drawing both makes the sore-throat case honest: its window runs
 * past the edge of what Fleur can see.
 */
export function LagTimeline({
  from,
  to,
  horizon = 14,
  max = 21,
}: {
  from: number;
  to: number;
  horizon?: number;
  max?: number;
}): React.ReactElement {
  const { palette } = useTheme();
  const [width, setWidth] = React.useState(0);
  const height = 54;
  const trackY = 20;
  const x = (day: number): number => (day / max) * width;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Rect x={0} y={trackY} width={width} height={8} rx={4} fill={palette.surfaceAlt} />
          <Rect
            x={x(from)}
            y={trackY - 3}
            width={Math.max(x(to) - x(from), 6)}
            height={14}
            rx={7}
            fill={palette.primary}
          />
          <Line
            x1={x(horizon)}
            y1={trackY - 10}
            x2={x(horizon)}
            y2={trackY + 18}
            stroke={palette.borderStrong}
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          {[0, 7, 14, 21].map((day) => (
            <G key={day}>
              <Circle cx={x(day)} cy={trackY + 4} r={1.5} fill={palette.textFaint} />
            </G>
          ))}
        </Svg>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -12 }}>
        <Txt variant="caption" tone="faint">
          today
        </Txt>
        <Txt variant="caption" tone="faint">
          {`${max} days`}
        </Txt>
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------
// History — activity grid
// --------------------------------------------------------------------------

const WEEKDAY_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

/**
 * Severity grid, one column per week and one row per weekday.
 *
 * Aligning to real weekdays (rather than packing cells in reading order) means
 * a person can see that their bad days cluster at weekends.
 */
export function ActivityGrid({
  days,
  onSelect,
}: {
  days: readonly { date: string; severity: number | null }[];
  onSelect: (date: string) => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const [width, setWidth] = React.useState(0);

  const gap = 3.5;
  const labelWidth = 16;
  const rows = 7;

  const cells = useMemo(() => {
    return days.map((day) => {
      const [y, m, d] = day.date.split('-').map(Number);
      // Monday-first row index.
      const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
      return { ...day, weekday };
    });
  }, [days]);

  const columns = useMemo(() => {
    if (cells.length === 0) return 0;
    let column = 0;
    let previous = cells[0].weekday;
    for (let i = 1; i < cells.length; i += 1) {
      if (cells[i].weekday <= previous) column += 1;
      previous = cells[i].weekday;
    }
    return column + 1;
  }, [cells]);

  const cell =
    width > 0 && columns > 0
      ? Math.max((width - labelWidth - gap * (columns - 1)) / columns, 4)
      : 0;
  const height = rows * (cell + gap);

  const colorFor = (severity: number | null): string => {
    if (severity === null) return palette.surfaceAlt;
    const index = Math.min(
      palette.heat.length - 1,
      Math.floor((severity / 10) * palette.heat.length),
    );
    return palette.heat[index];
  };

  let column = 0;
  let previousWeekday = cells.length ? cells[0].weekday : 0;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && cell > 0 ? (
        <Svg width={width} height={height}>
          {WEEKDAY_LABELS.map((label, row) =>
            label ? (
              <Rect
                key={`l${row}`}
                x={0}
                y={row * (cell + gap) + cell / 2 - 1}
                width={7}
                height={2}
                rx={1}
                fill={palette.textFaint}
                opacity={0.5}
              />
            ) : null,
          )}
          {cells.map((item, index) => {
            if (index > 0 && item.weekday <= previousWeekday) column += 1;
            previousWeekday = item.weekday;
            return (
              <Rect
                key={item.date}
                x={labelWidth + column * (cell + gap)}
                y={item.weekday * (cell + gap)}
                width={cell}
                height={cell}
                rx={Math.min(4, cell / 3)}
                fill={colorFor(item.severity)}
                onPress={() => onSelect(item.date)}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

export function HeatLegend({ style }: { style?: StyleProp<ViewStyle> }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}
      accessibilityLabel="Scale from clear skin to most severe"
    >
      <Txt variant="caption" tone="faint">
        Clear
      </Txt>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {palette.heat.map((color) => (
          <View
            key={color}
            style={{ width: 20, height: 9, borderRadius: 3, backgroundColor: color }}
          />
        ))}
      </View>
      <Txt variant="caption" tone="faint">
        Severe
      </Txt>
    </View>
  );
}

/** Small inline ring used for compact progress readouts. */
export function MiniRing({
  fraction,
  size = 44,
  color,
  track,
}: {
  fraction: number;
  size?: number;
  color: string;
  track: string;
}): React.ReactElement {
  const stroke = 4;
  const r = size / 2 - stroke;
  const circumference = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference * Math.min(Math.max(fraction, 0), 1)} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export { radius as chartRadius };
export type { Palette as ChartPalette };

// --------------------------------------------------------------------------
// Rule history
// --------------------------------------------------------------------------

/**
 * One rule's points, day by day — a big, plain line for the rule detail page.
 * The dashed line on top is the most the rule can ever add, so "how close to
 * full" reads without any numbers. Missing days break the line.
 */
export function RuleChart({
  points,
  max,
  color,
  height = 220,
}: {
  points: readonly TrendPoint[];
  /** The rule's maximum, as a positive number. */
  max: number;
  color: string;
  height?: number;
}): React.ReactElement {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);
  const fillId = useId().replace(/:/g, '');

  const axis = 34;
  const plotWidth = Math.max(0, width - axis);
  const top = 12;
  const bottom = height - 26;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const yFor = (value: number): number => bottom - (Math.min(value, max) / max) * (bottom - top);

  const { segments, areas, last } = useMemo(() => {
    const segs: string[] = [];
    const ars: string[] = [];
    let line = '';
    let startX = 0;
    let prevX = 0;
    let lastDot: { x: number; y: number } | null = null;
    const close = (): void => {
      if (!line) return;
      segs.push(line);
      ars.push(`${line} L ${prevX} ${bottom} L ${startX} ${bottom} Z`);
      line = '';
    };
    points.forEach((p, i) => {
      const x = axis + i * step;
      if (p.value === null) {
        close();
        return;
      }
      const y = yFor(p.value);
      if (!line) {
        line = `M ${x} ${y}`;
        startX = x;
      } else {
        line += ` L ${x} ${y}`;
      }
      prevX = x;
      lastDot = { x, y };
    });
    close();
    return { segments: segs, areas: ars, last: lastDot as { x: number; y: number } | null };
  }, [points, step, max, bottom]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={axis} y1={top} x2={width} y2={top} stroke={palette.borderStrong} strokeDasharray="4 4" />
          <Line x1={axis} y1={bottom} x2={width} y2={bottom} stroke={palette.border} />
          {areas.map((d, i) => (
            <Path key={`a${i}`} d={d} fill={`url(#${fillId})`} />
          ))}
          {segments.map((d, i) => (
            <Path
              key={`s${i}`}
              d={d}
              stroke={color}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {last ? <Circle cx={last.x} cy={last.y} r={6} fill={color} /> : null}
        </Svg>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: top - 8 }}>
        <Txt variant="caption" tone="faint">{`${max}`}</Txt>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: bottom - 9 }}>
        <Txt variant="caption" tone="faint">0</Txt>
      </View>
      {points.length > 0 ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: axis, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' }}
        >
          <Txt variant="caption" tone="faint">{formatShort(points[0].date)}</Txt>
          <Txt variant="caption" tone="faint">Today</Txt>
        </View>
      ) : null}
    </View>
  );
}
