/**
 * Check-in inputs (REQUIREMENTS §11.3).
 *
 * The slider is hand-rolled rather than pulled from a package: it is one
 * PanResponder and some arithmetic, and it keeps the dependency budget (§16)
 * for things that earn it. FR-2.6 requires every slider to show its numeric
 * value and a text anchor at each end — that is baked into the component so it
 * cannot be forgotten at a call site.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing, type Gradient } from '../theme';
import { GradientFill } from './gradient';
import { CheckIcon } from './icons';
import { PressableScale } from './motion';
import { Txt } from './primitives';

const TRACK_HEIGHT = 10;
export const THUMB_SIZE = 30;

/**
 * Slider geometry, extracted so it can be tested without rendering.
 *
 * `positionFromValue` and `valueFromPosition` are inverses: the thumb's centre
 * for a value must be the touch position that produces that same value, or the
 * control fights the finger.
 */
export function positionFromValue(
  value: number,
  width: number,
  min: number,
  max: number,
): number {
  const span = max - min;
  if (span <= 0) return 0;
  const ratio = Math.min(Math.max((value - min) / span, 0), 1);
  return ratio * Math.max(width - THUMB_SIZE, 0);
}

export function valueFromPosition(
  x: number,
  width: number,
  min: number,
  max: number,
  step: number,
): number {
  const usable = Math.max(width - THUMB_SIZE, 1);
  const ratio = Math.min(Math.max((x - THUMB_SIZE / 2) / usable, 0), 1);
  const raw = min + ratio * (max - min);
  const snapped = Math.round(raw / step) * step;
  // Re-round to kill float dust from fractional steps (0.1 + 0.2 arithmetic).
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(decimals))));
}

export interface ScaleSliderProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** FR-2.6: a text anchor is required at each end. */
  minAnchor: string;
  maxAnchor: string;
  unit?: string;
  placeholder?: string;
  gradient?: Gradient;
  compact?: boolean;
}

export function ScaleSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  minAnchor,
  maxAnchor,
  unit = '',
  placeholder = 'Not set',
  gradient,
  compact = false,
}: ScaleSliderProps): React.ReactElement {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const ramp = gradient ?? palette.gradients.primary;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  }, []);

  // The handler is read through a ref so the PanResponder can be created once.
  // Call sites pass an inline arrow, so depending on `onChange` directly would
  // rebuild the responder on every render — including mid-drag, which swaps
  // the handlers out from under an in-flight gesture.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) =>
          onChangeRef.current(
            valueFromPosition(event.nativeEvent.locationX, widthRef.current, min, max, step),
          ),
        onPanResponderMove: (event) =>
          onChangeRef.current(
            valueFromPosition(event.nativeEvent.locationX, widthRef.current, min, max, step),
          ),
      }),
    [min, max, step],
  );

  const thumbLeft = positionFromValue(value ?? min, width, min, max);
  // Pixels, derived from the thumb, rather than a percentage of the track.
  // A percentage is computed against a different span than the thumb offset
  // (the thumb can only travel `width - THUMB_SIZE`), so the two drift apart
  // and the fill visibly lags behind the handle at the top of the range.
  // Ending the fill at the thumb's centre keeps them locked together.
  const fillWidth = thumbLeft + THUMB_SIZE / 2;
  const isSet = value !== null;

  return (
    <View style={{ marginBottom: compact ? spacing.lg : spacing.xl }}>
      <View style={styles.headerRow}>
        <Txt variant="label">{label}</Txt>
        <View
          style={{
            backgroundColor: isSet ? palette.primarySoft : palette.surfaceAlt,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: 3,
          }}
        >
          <Txt variant="label" tone={isSet ? 'accent' : 'faint'}>
            {isSet ? `${value}${unit}` : placeholder}
          </Txt>
        </View>
      </View>

      <View
        onLayout={onLayout}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value ?? min }}
        style={styles.touchArea}
      >
        {/* Both children are transparent to touches. `locationX` is measured
            against whichever view the finger is actually over — and the thumb
            sits under the finger by definition once it catches up — so a
            hittable thumb makes the reading collapse to 0-30px inside it, and
            the value snaps to the minimum mid-drag. */}
        <View
          pointerEvents="none"
          style={[styles.track, { backgroundColor: palette.surfaceAlt }]}
        >
          {/* Solid base plus a full-track gradient clipped to the fill width.
              A percentage-sized SVG inside a resizing parent did not follow it
              reliably, leaving the bar stale. Painting the gradient at a fixed
              full-track width and clipping it also makes the colour ramp span
              the whole scale rather than compressing into the filled part. */}
          {isSet && fillWidth > 0 ? (
            <View
              style={{
                width: fillWidth,
                height: TRACK_HEIGHT,
                overflow: 'hidden',
                backgroundColor: ramp.from,
              }}
            >
              {width > 0 ? (
                <View style={{ width, height: TRACK_HEIGHT }}>
                  <GradientFill gradient={ramp} angle="horizontal" />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: thumbLeft,
              backgroundColor: palette.surface,
              borderColor: isSet ? ramp.to : palette.borderStrong,
              shadowColor: palette.shadow,
            },
          ]}
        />
      </View>

      <View style={styles.headerRow}>
        <Txt variant="caption" tone="faint">{`${min} · ${minAnchor}`}</Txt>
        <Txt variant="caption" tone="faint">{`${max} · ${maxAnchor}`}</Txt>
      </View>
    </View>
  );
}

/** Pill toggle, used where labels are short and the grid should read as a choice. */
export function ChipToggle({
  label,
  value,
  onChange,
  style,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      scaleTo={0.94}
      style={[
        styles.chip,
        {
          backgroundColor: value ? 'transparent' : palette.surfaceAlt,
          borderColor: value ? 'transparent' : palette.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {value ? <GradientFill gradient={palette.gradients.primary} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {value ? <CheckIcon size={15} color={palette.onAccent} /> : null}
        <Txt variant="label" style={{ color: value ? palette.onAccent : palette.text }}>
          {label}
        </Txt>
      </View>
    </PressableScale>
  );
}

/**
 * Tappable card with a title and an explanatory hint.
 *
 * Events need the hint — "skin injury" means little until you read "cut,
 * scratch, sunburn, friction" — and a full-width target is far easier to hit
 * than a switch.
 */
export function SelectableCard({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      onPress={() => onChange(!value)}
      scaleTo={0.985}
      style={[
        styles.selectable,
        {
          backgroundColor: value ? palette.primarySoft : palette.surfaceAlt,
          borderColor: value ? palette.primary : 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.tick,
          {
            backgroundColor: value ? palette.primary : 'transparent',
            borderColor: value ? palette.primary : palette.borderStrong,
          },
        ]}
      >
        {/* Paired with accessibilityState above, so the tick is never the only
            signal that something is selected. */}
        {value ? <CheckIcon size={14} color={palette.onAccent} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="label">{label}</Txt>
        {hint ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Txt variant="body">{label}</Txt>
        {hint ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <View
        style={{
          width: 52,
          height: 31,
          borderRadius: radius.pill,
          padding: 3,
          justifyContent: 'center',
          backgroundColor: value ? palette.primary : palette.surfaceSunken,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: value ? palette.primary : palette.border,
        }}
      >
        <View
          style={{
            width: 25,
            height: 25,
            borderRadius: 13,
            backgroundColor: palette.surface,
            alignSelf: value ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
}

export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (next: T) => void;
  labels: Readonly<Record<T, string>>;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <PressableScale
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={labels[option]}
            onPress={() => onChange(option)}
            scaleTo={0.94}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? 'transparent' : palette.surface,
                borderColor: selected ? 'transparent' : palette.border,
                overflow: 'hidden',
              },
            ]}
          >
            {selected ? <GradientFill gradient={palette.gradients.primary} /> : null}
            <Txt variant="label" style={{ color: selected ? palette.onAccent : palette.text }}>
              {labels[option]}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Segmented progress across the check-in steps. */
export function StepProgress({
  total,
  current,
}: {
  total: number;
  current: number;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: 5 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: palette.surfaceAlt,
          }}
        >
          {i <= current ? <GradientFill gradient={palette.gradients.primary} angle="horizontal" /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  touchArea: {
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectable: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
