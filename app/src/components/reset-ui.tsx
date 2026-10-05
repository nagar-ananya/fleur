import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import { radius, spacing } from '../theme';
import { CheckIcon, ChevronRight } from './icons';
import { PressableScale } from './motion';
import { Card, Txt } from './primitives';

export function ChecklistRow({
  title,
  meta,
  done,
  onToggle,
}: {
  title: string;
  meta?: string;
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
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            borderColor: done ? palette.primary : palette.borderStrong,
            backgroundColor: done ? palette.primary : palette.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <CheckIcon size={17} color={palette.onAccent} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="label" style={done ? { color: palette.textFaint, textDecorationLine: 'line-through' } : undefined}>
            {title}
          </Txt>
          {meta ? (
            <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
              {meta}
            </Txt>
          ) : null}
        </View>
      </Card>
    </PressableScale>
  );
}

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
      const growing = index % 2 === 0;
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
      <Svg width={size * 0.76} height={size * 0.76} style={{ position: 'absolute' }}>
        <Circle
          cx={(size * 0.76) / 2}
          cy={(size * 0.76) / 2}
          r={(size * 0.76) / 2 - 3}
          stroke={palette.primary}
          strokeWidth={2}
          fill="none"
          opacity={0.6}
        />
      </Svg>
      <View style={{ alignItems: 'center', width: size * 0.9 }}>
        <Txt variant="title">{label || '—'}</Txt>
        <Txt variant="caption" tone="faint" center style={{ alignSelf: 'stretch', marginTop: 4 }}>
          {pattern.map((p) => `${p}`).join(' - ')}
        </Txt>
      </View>
      <View style={{ position: 'absolute', bottom: 0, opacity: 0 }}>
        <Txt variant="caption">{`${total}s cycle`}</Txt>
      </View>
    </View>
  );
}

export const RESET_CARD_RADIUS = radius.lg;
