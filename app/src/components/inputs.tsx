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
import { CheckIcon } from './icons';
import { PressableScale } from './motion';
import { Txt } from './primitives';

const TRACK_HEIGHT = 10;
export const THUMB_SIZE = 30;

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

  // Keep the latest onChange in a ref so the PanResponder is only made once.
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
        <View
          pointerEvents="none"
          style={[styles.track, { backgroundColor: palette.surfaceSunken }]}
        >
          {isSet && fillWidth > 0 ? (
            <View style={{ width: fillWidth, height: TRACK_HEIGHT, backgroundColor: ramp.to }} />
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
        <Txt variant="caption" tone="faint">{`${min} - ${minAnchor}`}</Txt>
        <Txt variant="caption" tone="faint">{`${max} - ${maxAnchor}`}</Txt>
      </View>
    </View>
  );
}

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
          backgroundColor: value ? palette.primary : palette.surface,
          borderColor: value ? palette.primaryDeep : palette.border,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {value ? <CheckIcon size={15} color={palette.onAccent} /> : null}
        <Txt variant="label" style={{ color: value ? palette.onAccent : palette.text }}>
          {label}
        </Txt>
      </View>
    </PressableScale>
  );
}

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
                backgroundColor: selected ? palette.primary : palette.surface,
                borderColor: selected ? palette.primaryDeep : palette.border,
              },
            ]}
          >
            <Txt variant="label" style={{ color: selected ? palette.onAccent : palette.text }}>
              {labels[option]}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

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
            height: 6,
            borderRadius: 3,
            backgroundColor: i <= current ? palette.primary : palette.surfaceSunken,
          }}
        />
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
    borderWidth: 1,
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

export function YesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {([true, false] as const).map((option) => {
        const selected = value === option;
        return (
          <PressableScale
            key={String(option)}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option ? 'Yes' : 'No'}
            style={{
              flex: 1,
              height: 96,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: selected ? palette.primary : palette.surface,
              backgroundColor: selected ? palette.primarySoft : palette.surface,
            }}
          >
            <Txt variant="title" style={{ color: selected ? palette.primary : palette.text }}>
              {option ? 'Yes' : 'No'}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function NumberStepper({
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  max,
}: {
  value: number | null;
  onChange: (next: number) => void;
  unit: string;
  step?: number;
  min?: number;
  max: number;
}): React.ReactElement {
  const { palette } = useTheme();
  const current = value ?? min;
  const set = (next: number): void => onChange(Math.min(max, Math.max(min, next)));
  const button = (label: string, delta: number, disabled: boolean): React.ReactElement => (
    <PressableScale
      onPress={() => set(current + delta)}
      disabled={disabled}
      accessibilityLabel={delta > 0 ? `More ${unit}` : `Fewer ${unit}`}
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.surface,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Txt variant="title" tone="accent">
        {label}
      </Txt>
    </PressableScale>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {button('−', -step, value !== null && current <= min)}
      <View style={{ alignItems: 'center' }}>
        <Txt variant="hero" style={{ fontSize: 64, lineHeight: 76 }}>
          {value === null ? '—' : `${current}`}
        </Txt>
        <Txt tone="muted">{unit}</Txt>
      </View>
      {button('+', step, current >= max)}
    </View>
  );
}
