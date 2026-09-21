/**
 * Shared pieces for the Reset tab: a tappable session row (used by all six
 * category lists), a checklist row (wind-down / skin routine), and the
 * breathing ring used by the one session with a real timed pattern.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import { radius, spacing } from '../theme';
import { ChevronRight } from './icons';
import { PressableScale } from './motion';
import { Card, Pill, Txt } from './primitives';

export function SessionRow({
  icon,
  title,
  meta,
  tag,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  tag?: string;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={title}
      scaleTo={0.985}
      style={{ marginBottom: spacing.sm }}
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {icon}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Txt variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {title}
            </Txt>
            {tag ? (
              <Pill label={tag} color={palette.primary} background={palette.primarySoft} />
            ) : null}
          </View>
          <Txt variant="caption" tone="faint" style={{ marginTop: 3 }} numberOfLines={1}>
            {meta}
          </Txt>
        </View>
        <ChevronRight size={16} color={palette.textFaint} />
      </Card>
    </PressableScale>
  );
}

export function ChecklistRow({
  title,
  meta,
  done,
  onToggle,
}: {
  title: string;
  meta: string;
  done: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <PressableScale
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={title}
      scaleTo={0.99}
      style={{ marginBottom: spacing.sm }}
    >
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: 64,
          borderColor: done ? palette.primary : palette.border,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: done ? palette.primary : palette.borderStrong,
            backgroundColor: done ? palette.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.onAccent }} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="label" style={done ? { color: palette.textFaint, textDecorationLine: 'line-through' } : undefined}>
            {title}
          </Txt>
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {meta}
          </Txt>
        </View>
      </Card>
    </PressableScale>
  );
}

/**
 * A breathing pacer: a ring that grows and shrinks through a phase pattern
 * (e.g. 4s in, 7s hold, 8s out), with the current phase named in the centre.
 *
 * Pausable — `playing` stops the animation exactly where it is rather than
 * resetting, so toggling play does not visually snap.
 */
export function BreathingRing({
  pattern,
  phaseLabels,
  playing,
  size = 220,
}: {
  pattern: readonly number[];
  phaseLabels: readonly string[];
  playing: boolean;
  size?: number;
}): React.ReactElement {
  const { palette } = useTheme();
  const scale = useRef(new Animated.Value(0.82)).current;
  const [phaseIndex, setPhaseIndex] = useState(0);
  const total = useMemo(() => pattern.reduce((a, b) => a + b, 0) || 1, [pattern]);

  useEffect(() => {
    if (!playing || pattern.length === 0) return;
    let cancelled = false;
    let index = 0;

    const runPhase = (): void => {
      if (cancelled) return;
      const duration = Math.max(pattern[index], 0.5) * 1000;
      const growing = index % 2 === 0; // inhale-style phases grow, hold/exhale settle back
      setPhaseIndex(index);
      Animated.timing(scale, {
        toValue: growing ? 1 : 0.82,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        index = (index + 1) % pattern.length;
        runPhase();
      });
    };
    runPhase();
    return () => {
      cancelled = true;
      scale.stopAnimation();
    };
  }, [playing, pattern, scale]);

  const label = phaseLabels[phaseIndex] || '';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.primarySoft,
          transform: [{ scale }],
        }}
      />
      <Svg width={size * 0.62} height={size * 0.62} style={{ position: 'absolute' }}>
        <Circle
          cx={(size * 0.62) / 2}
          cy={(size * 0.62) / 2}
          r={(size * 0.62) / 2 - 3}
          stroke={palette.primary}
          strokeWidth={2}
          fill="none"
          opacity={0.6}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Txt variant="title">{label || '—'}</Txt>
        <Txt variant="caption" tone="faint" style={{ marginTop: 4, letterSpacing: 1 }}>
          {pattern.map((p) => `${p}`).join(' · ').toUpperCase()}
        </Txt>
      </View>
      <View style={{ position: 'absolute', bottom: 0, opacity: 0 }}>
        <Txt variant="caption">{`${total}s cycle`}</Txt>
      </View>
    </View>
  );
}

/** Small pill-style radius reused by a couple of Reset screens. */
export const RESET_CARD_RADIUS = radius.lg;
