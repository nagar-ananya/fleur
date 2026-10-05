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
  radius,
  spacing,
  typography,
  type Gradient,
  type Palette,
} from '../theme';
import { AuroraBackdrop, GradientFill } from './gradient';
import { PressableScale } from './motion';

export function Screen({
  children,
  edges = ['top'],
  scroll = true,
  aurora = false,
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

export function Kicker({
  children,
  tone = 'muted',
  style,
}: {
  children: React.ReactNode;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
}): React.ReactElement {
  return (
    <Txt variant="caption" tone={tone} style={[{ fontWeight: '600' }, style]}>
      {children}
    </Txt>
  );
}

export function ScreenTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}): React.ReactElement {
  return (
    <View>
      {kicker ? <Kicker style={{ marginBottom: 2 }}>{kicker}</Kicker> : null}
      <Txt variant="display">{title}</Txt>
      {subtitle ? (
        <Txt tone="muted" style={{ marginTop: spacing.xs, lineHeight: 22 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
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

export function Card({
  children,
  style,
  padded = true,
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
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

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
  return (
    <View style={[{ borderRadius: radius.xl, overflow: 'hidden' }, style]}>
      <GradientFill gradient={gradient} />
      <View style={{ padding: padded ? spacing.lg : 0 }}>{children}</View>
    </View>
  );
}

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
    variant === 'primary'
      ? palette.primary
      : variant === 'secondary'
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
          borderRadius: radius.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: background,
          borderWidth: variant === 'quiet' ? 1 : 0,
          borderColor: palette.borderStrong,
        },
        style,
      ]}
    >
      {icon}
      <Text style={[typography.label, { color: labelColor, fontSize: 16 }]}>{label}</Text>
    </PressableScale>
  );
}

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
          paddingVertical: 4,
        },
        style,
      ]}
    >
      {icon}
      <Text style={[typography.caption, { color, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

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

export function NumberCircle({
  value,
  size = 30,
  color,
  background,
}: {
  value: number | string;
  size?: number;
  color?: string;
  background?: string;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background ?? palette.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[typography.label, { fontSize: size * 0.46, color: color ?? palette.primary }]}>
        {value}
      </Text>
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

export function ShortDisclaimer({ style }: { style?: StyleProp<ViewStyle> }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View style={[{ paddingVertical: spacing.xl, alignItems: 'center' }, style]}>
      <Text style={[typography.caption, { color: palette.textFaint }]}>{DISCLAIMER_SHORT}</Text>
    </View>
  );
}
