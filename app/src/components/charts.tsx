/**
 * Charts, hand-rolled on react-native-svg (REQUIREMENTS §5.1, §11).
 *
 * §11.5 applies throughout: no red, no alarm iconography, and colour never
 * carries meaning on its own — every band, direction and state is paired with
 * a text label or an accessibility label.
 */

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
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
import { bandStyle, radius, spacing, type Gradient, type Palette } from '../theme';
import type { RiskBand } from '../types/models';
import { GradientFill } from './gradient';
import { PressableScale } from './motion';
import { Txt } from './primitives';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// react-native-svg types stroke props as NumberProp, which an Animated value is
// not assignable to even though the library handles it. One narrow cast here
// keeps every call site clean, and avoids `any` entirely (§16).
type StrokeValue = Animated.AnimatedInterpolation<number> | Animated.Value;
const asStroke = (value: StrokeValue): number => value as unknown as number;

// --------------------------------------------------------------------------
// Geometry
// --------------------------------------------------------------------------

/** Gauge sweep: 270°, starting bottom-left, leaving a 90° gap at the bottom. */
const DIAL_START = 135;
const DIAL_SWEEP = 270;

function polar(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const start = polar(cx, cy, r, from);
  const end = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}

/**
 * Band boundaries as a fraction of the dial. The dial tops out at 1.5x the
 * model threshold, so these are constant: low occupies 40%, elevated the next
 * 26.7%, high the last third. The needle can therefore never disagree with
 * the band label.
 */
const LOW_END = 0.4;
const ELEVATED_END = 2 / 3;

// --------------------------------------------------------------------------
// Risk dial
// --------------------------------------------------------------------------

export function RiskDial({
  probability,
  band,
  threshold,
  size = 260,
  children,
}: {
  probability: number;
  band: RiskBand;
  threshold: number;
  size?: number;
  children?: React.ReactNode;
}): React.ReactElement {
  const { palette } = useTheme();
  const style = bandStyle(band, palette);
  const gradientId = useId().replace(/:/g, '');

  const strokeWidth = 20;
  const r = (size - strokeWidth) / 2 - 4;
  const cx = size / 2;
  const cy = r + strokeWidth / 2 + 4;
  const height = cy + r * Math.sin((DIAL_START * Math.PI) / 180) + strokeWidth / 2 + 6;

  const ceiling = threshold * 1.5;
  const fraction = Math.min(Math.max(probability / ceiling, 0), 1);
  const arcLength = 2 * Math.PI * r * (DIAL_SWEEP / 360);

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: fraction,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      // SVG stroke props cannot run on the native driver.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fraction, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [arcLength, 0],
  });

  const zone = (from: number, to: number): string =>
    arc(cx, cy, r, DIAL_START + from * DIAL_SWEEP, DIAL_START + to * DIAL_SWEEP);

  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={style.gradient.from} />
            <Stop offset="1" stopColor={style.gradient.to} />
          </LinearGradient>
        </Defs>

        {/* Band zones, drawn faintly so the scale is readable at a glance. */}
        <Path d={zone(0, LOW_END - 0.006)} stroke={palette.bandLowSoft} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <Path d={zone(LOW_END + 0.006, ELEVATED_END - 0.006)} stroke={palette.bandElevatedSoft} strokeWidth={strokeWidth} fill="none" />
        <Path d={zone(ELEVATED_END + 0.006, 1)} stroke={palette.bandHighSoft} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />

        {/* The value, sweeping up from zero on mount. */}
        <AnimatedPath
          d={zone(0, 1)}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={arcLength}
          strokeDashoffset={asStroke(dashOffset)}
        />
      </Svg>

      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: r * 0.32,
        }}
        pointerEvents="none"
      >
        {children}
      </View>
    </View>
  );
}

/**
 * The pre-forecast state, on the same dial so the two never feel like
 * different screens: one dot per required day, filled as they are logged.
 *
 * A bare "0 of 14" gave the user nothing to feel progress against. Fourteen
 * dots that fill in one at a time turn the two-week cold start into something
 * legible.
 */
export function ProgressDial({
  current,
  total,
  size = 260,
  children,
}: {
  current: number;
  total: number;
  size?: number;
  children?: React.ReactNode;
}): React.ReactElement {
  const { palette } = useTheme();
  const dotRadius = 7;
  const r = size / 2 - dotRadius - 8;
  const cx = size / 2;
  const cy = r + dotRadius + 8;
  const height = cy + r * Math.sin((DIAL_START * Math.PI) / 180) + dotRadius + 10;

  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(appear, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [appear]);

  return (
    <Animated.View style={{ width: size, height, opacity: appear }}>
      <Svg width={size} height={height}>
        <Path
          d={arc(cx, cy, r, DIAL_START, DIAL_START + DIAL_SWEEP)}
          stroke={palette.surfaceAlt}
          strokeWidth={2}
          fill="none"
        />
        {Array.from({ length: total }, (_, i) => {
          const t = total === 1 ? 0 : i / (total - 1);
          const point = polar(cx, cy, r, DIAL_START + t * DIAL_SWEEP);
          const done = i < current;
          return (
            <Circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={done ? dotRadius : dotRadius - 2.5}
              fill={done ? palette.primary : palette.surfaceAlt}
              stroke={done ? palette.primary : palette.border}
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: r * 0.3,
        }}
        pointerEvents="none"
      >
        {children}
      </View>
    </Animated.View>
  );
}

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
export function TrendChart({
  points,
  height = 96,
  max = 10,
  gradient,
  showDots = true,
}: {
  points: readonly TrendPoint[];
  height?: number;
  max?: number;
  gradient?: Gradient;
  showDots?: boolean;
}): React.ReactElement {
  const { palette } = useTheme();
  const [width, setWidth] = React.useState(0);
  const fillId = useId().replace(/:/g, '');
  const lineId = useId().replace(/:/g, '');
  const ramp = gradient ?? palette.gradients.trend;

  const top = 10;
  const bottom = height - 14;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const yFor = (value: number): number => bottom - (value / max) * (bottom - top);

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

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
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
        </Svg>
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
 * §7.4 documents each trigger's latency and §7.3 caps the model's lookback at
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
