/**
 * Layout and typography primitives.
 *
 * Small and local by design — §11.5 rules out pulling in a component library,
 * and everything here is a handful of lines over React Native's own views.
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { DISCLAIMER_SHORT } from '../constants/copy';
import { useTheme } from '../hooks/useTheme';
import {
  MIN_TOUCH_TARGET,
  elevation,
  radius,
  spacing,
  typography,
  type Gradient,
  type Palette,
} from '../theme';
import { AuroraBackdrop, GradientFill } from './gradient';
import { PressableScale } from './motion';

// --------------------------------------------------------------------------
// Screen
// --------------------------------------------------------------------------

export function Screen({
  children,
  edges = ['top'],
  scroll = true,
  aurora = true,
  contentStyle,
}: {
  children: React.ReactNode;
  edges?: readonly Edge[];
  scroll?: boolean;
  aurora?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const { palette } = useTheme();

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        { padding: spacing.lg, paddingBottom: spacing.xxxl },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, padding: spacing.lg }, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {aurora ? <AuroraBackdrop colors={palette.aurora} /> : null}
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {body}
      </SafeAreaView>
    </View>
  );
}

// --------------------------------------------------------------------------
// Text
// --------------------------------------------------------------------------

type TextVariant = keyof typeof typography;
type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'onAccent';

function toneColor(tone: Tone, palette: Palette): string {
  switch (tone) {
    case 'muted':
      return palette.textMuted;
    case 'faint':
      return palette.textFaint;
    case 'accent':
      return palette.primary;
    case 'onAccent':
      return palette.onAccent;
    default:
      return palette.text;
  }
}

export function Txt({
  children,
  variant = 'body',
  tone = 'default',
  style,
  numberOfLines,
  center,
}: {
  children: React.ReactNode;
  variant?: TextVariant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <Text
      style={[
        typography[variant],
        { color: toneColor(tone, palette) },
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

/** Small all-caps kicker above a heading. */
export function Kicker({
  children,
  tone = 'faint',
  style,
}: {
  children: React.ReactNode;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
}): React.ReactElement {
  return (
    <Txt variant="micro" tone={tone} style={[{ textTransform: 'uppercase' }, style]}>
      {children}
    </Txt>
  );
}

export function SectionHeading({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xl,
        marginBottom: spacing.md,
      }}
    >
      <Txt variant="heading">{children}</Txt>
      {action}
    </View>
  );
}

// --------------------------------------------------------------------------
// Surfaces
// --------------------------------------------------------------------------

export function Card({
  children,
  style,
  padded = true,
  level = 1,
  tone = 'surface',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  level?: 1 | 2 | 3;
  tone?: 'surface' | 'alt' | 'sunken';
}): React.ReactElement {
  const { palette } = useTheme();
  const background =
    tone === 'alt'
      ? palette.surfaceAlt
      : tone === 'sunken'
        ? palette.surfaceSunken
        : palette.surface;

  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
          padding: padded ? spacing.lg : 0,
        },
        elevation(palette, level),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Card whose background is a gradient; children should use `onAccent` text. */
export function FeatureCard({
  children,
  gradient,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  gradient: Gradient;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={[
        { borderRadius: radius.xl, overflow: 'hidden' },
        elevation(palette, 2),
        style,
      ]}
    >
      <GradientFill gradient={gradient} />
      <View style={{ padding: padded ? spacing.lg : 0 }}>{children}</View>
    </View>
  );
}

// --------------------------------------------------------------------------
// Controls
// --------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'destructive';
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const { palette } = useTheme();

  const labelColor =
    variant === 'primary'
      ? palette.onAccent
      : variant === 'destructive'
        ? palette.destructive
        : palette.text;

  const background =
    variant === 'secondary'
      ? palette.surfaceAlt
      : variant === 'destructive'
        ? palette.destructiveSoft
        : 'transparent';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        {
          minHeight: MIN_TOUCH_TARGET + 6,
          borderRadius: radius.pill,
          overflow: 'hidden',
          justifyContent: 'center',
          backgroundColor: background,
          borderWidth: variant === 'quiet' ? StyleSheet.hairlineWidth : 0,
          borderColor: palette.borderStrong,
        },
        style,
      ]}
    >
      {variant === 'primary' ? <GradientFill gradient={palette.gradients.primary} /> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        {icon}
        <Text style={[typography.label, { color: labelColor, fontSize: 16 }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

/** Small status pill. Always carries text — never colour alone (§11.5). */
export function Pill({
  label,
  color,
  background,
  icon,
  style,
}: {
  label: string;
  color: string;
  background: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          backgroundColor: background,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
        },
        style,
      ]}
    >
      {icon ?? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />}
      <Text style={[typography.caption, { color, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

/** Compact metric tile, used in bento rows. */
export function StatTile({
  value,
  label,
  accent,
  style,
}: {
  value: string;
  label: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View style={[{ flex: 1, alignItems: 'center', gap: 2 }, style]}>
      <Text style={[typography.title, { color: accent ?? palette.text }]}>{value}</Text>
      <Text style={[typography.caption, { color: palette.textFaint, textAlign: 'center' }]}>
        {label}
      </Text>
    </View>
  );
}

/** A round tinted badge behind an icon. */
export function IconBadge({
  children,
  background,
  size = 40,
}: {
  children: React.ReactNode;
  background: string;
  size?: number;
}): React.ReactElement {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginVertical: spacing.md },
        style,
      ]}
    />
  );
}

/** FR-4.6: required on every screen that displays a risk value. */
export function ShortDisclaimer({ style }: { style?: StyleProp<ViewStyle> }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View style={[{ paddingVertical: spacing.xl, alignItems: 'center' }, style]}>
      <Text style={[typography.caption, { color: palette.textFaint }]}>{DISCLAIMER_SHORT}</Text>
    </View>
  );
}
