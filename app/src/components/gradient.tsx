/**
 * Gradient fills, painted with react-native-svg.
 *
 * `expo-linear-gradient` would be the obvious choice, but it is a native
 * module: adding it invalidates any installed development build until it is
 * recompiled. These do the same job with a library already in the bundle, and
 * keep the dependency budget (§16) for things that earn it.
 *
 * Each component fills its parent absolutely, so the usual shape is a View
 * with `borderRadius` and `overflow: 'hidden'` wrapping one of these plus the
 * real content.
 */

import React, { useId } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useDrift } from './motion';
import type { Gradient } from '../theme';

/** A linear gradient behind whatever is rendered on top of it. */
export function GradientFill({
  gradient,
  angle = 'diagonal',
  opacity = 1,
}: {
  gradient: Gradient;
  angle?: 'diagonal' | 'vertical' | 'horizontal';
  opacity?: number;
}): React.ReactElement {
  const id = useId().replace(/:/g, '');
  const coords =
    angle === 'vertical'
      ? { x1: '0', y1: '0', x2: '0', y2: '1' }
      : angle === 'horizontal'
        ? { x1: '0', y1: '0', x2: '1', y2: '0' }
        : { x1: '0', y1: '0', x2: '1', y2: '1' };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} {...coords}>
            <Stop offset="0" stopColor={gradient.from} stopOpacity={opacity} />
            <Stop offset="1" stopColor={gradient.to} stopOpacity={opacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Two soft colour washes drifting behind a screen header.
 *
 * This is the single biggest reason the app stopped looking like a form: flat
 * backgrounds read as unfinished, and a whole-screen gradient reads as garish.
 * Two low-opacity blobs give depth without ever competing with content.
 */
export function AuroraBackdrop({
  colors,
  height = 420,
  style,
}: {
  colors: readonly [string, string];
  height?: number;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const drift = useDrift(11000);

  const shiftA = drift.interpolate({ inputRange: [0, 1], outputRange: [-14, 18] });
  const shiftB = drift.interpolate({ inputRange: [0, 1], outputRange: [16, -12] });

  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, height }, style]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: shiftA }] }]}
      >
        <Blob color={colors[0]} cx="18%" cy="8%" rx="95%" ry="70%" opacity={0.9} />
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: shiftB }] }]}
      >
        <Blob color={colors[1]} cx="92%" cy="0%" rx="85%" ry="62%" opacity={0.75} />
      </Animated.View>
    </View>
  );
}

function Blob({
  color,
  cx,
  cy,
  rx,
  ry,
  opacity,
}: {
  color: string;
  cx: string;
  cy: string;
  rx: string;
  ry: string;
  opacity: number;
}): React.ReactElement {
  const id = useId().replace(/:/g, '');
  return (
    <Svg width="100%" height="100%">
      <Defs>
        {/* Radial falloff painted onto a full-bleed rect rather than onto an
            ellipse: an ellipse leaves a visible hard edge where the shape
            ends, which reads as a smudge on the screen rather than as light. */}
        <RadialGradient id={id} cx={cx} cy={cy} rx={rx} ry={ry} fx={cx} fy={cy}>
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.45} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Rounded container that paints a gradient behind its children. */
export function GradientCard({
  gradient,
  radius,
  style,
  children,
}: {
  gradient: Gradient;
  radius: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <GradientFill gradient={gradient} />
      {children}
    </View>
  );
}
