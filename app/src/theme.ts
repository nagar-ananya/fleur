/**
 * Design system (REQUIREMENTS §11.5).
 *
 * Fleur is a health app about a visible, stigmatised skin condition, so the
 * palette carries a lot of weight. The rules that are not negotiable:
 *
 *   - No red and no alarm palette anywhere near risk. The top band is coral,
 *     labelled "High", never "Warning".
 *   - Light and dark are both first-class, not an afterthought toggle.
 *   - Colour never carries meaning alone; every band pairs with a text label.
 *   - Touch targets are at least 44pt.
 *
 * Within that, the system is deliberately warm and saturated rather than
 * clinical: iris and aqua for brand, a calm sequential ramp for severity, and
 * soft aurora washes for depth. Every text colour below was checked against
 * its intended background for WCAG AA (4.5:1 body, 3:1 large).
 */

import type { RiskBand } from './types/models';

export interface Gradient {
  readonly from: string;
  readonly to: string;
}

export interface Palette {
  // Surfaces, from furthest back to closest.
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;

  // Type.
  text: string;
  textMuted: string;
  textFaint: string;
  onAccent: string;

  // Brand.
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  aqua: string;
  aquaSoft: string;

  // Risk bands. `*Text` is contrast-safe on surfaces; `*Fill` is for arcs and
  // bars where the colour sits on its own.
  bandLowText: string;
  bandLowFill: string;
  bandLowSoft: string;
  bandElevatedText: string;
  bandElevatedFill: string;
  bandElevatedSoft: string;
  bandHighText: string;
  bandHighFill: string;
  bandHighSoft: string;

  positive: string;
  /** Destructive actions only — never risk presentation. */
  destructive: string;
  destructiveSoft: string;

  /** Two soft washes painted behind screen headers. */
  aurora: readonly [string, string];
  /** Sequential ramp for the severity heatmap, clear → severe. */
  heat: readonly string[];

  gradients: {
    primary: Gradient;
    hero: Gradient;
    low: Gradient;
    elevated: Gradient;
    high: Gradient;
    trend: Gradient;
  };

  shadow: string;
}

const light: Palette = {
  background: '#FBF9FF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F1FC',
  surfaceSunken: '#EEE9F8',
  border: '#E7E1F4',
  borderStrong: '#D5CCEA',

  text: '#17132A',
  textMuted: '#544D6B',
  textFaint: '#7C7597',
  onAccent: '#FFFFFF',

  primary: '#5B4BE0',
  primaryDeep: '#3B2CB0',
  primarySoft: '#ECE8FF',
  aqua: '#0E9E92',
  aquaSoft: '#DFF4F1',

  bandLowText: '#0F7A6E',
  bandLowFill: '#17B8A6',
  bandLowSoft: '#DEF4F0',
  bandElevatedText: '#8F6410',
  bandElevatedFill: '#EFA93B',
  bandElevatedSoft: '#FBEFD9',
  bandHighText: '#AE5039',
  bandHighFill: '#E9805F',
  bandHighSoft: '#FBE7DF',

  positive: '#0F7A6E',
  destructive: '#B4533C',
  destructiveSoft: '#FAE6E0',

  aurora: ['#DCD2FF', '#CFEDE8'],
  heat: ['#F1EDFA', '#D9F0EA', '#AFE3D4', '#F3DCA9', '#EFB587', '#E08C6C'],

  gradients: {
    primary: { from: '#6B57F0', to: '#4B3BC8' },
    hero: { from: '#5B4BE0', to: '#1E9E97' },
    low: { from: '#3ECFB8', to: '#0F9C8C' },
    elevated: { from: '#F5BF5C', to: '#DC9520' },
    high: { from: '#F2977A', to: '#D96A49' },
    trend: { from: '#6B57F0', to: '#1E9E97' },
  },

  shadow: '#2A1F52',
};

const dark: Palette = {
  background: '#0B0912',
  surface: '#16121F',
  surfaceAlt: '#1F1A2D',
  surfaceSunken: '#100D19',
  border: '#2B2440',
  borderStrong: '#3D3459',

  text: '#F5F2FB',
  textMuted: '#B6AFCB',
  textFaint: '#877FA4',
  onAccent: '#FFFFFF',

  primary: '#A192FF',
  primaryDeep: '#7C6AF0',
  primarySoft: '#241D3D',
  aqua: '#4FD3C2',
  aquaSoft: '#12312E',

  bandLowText: '#4FD3C2',
  bandLowFill: '#2CBFAC',
  bandLowSoft: '#12312E',
  bandElevatedText: '#F2BC63',
  bandElevatedFill: '#E5A63F',
  bandElevatedSoft: '#33270F',
  bandHighText: '#F3A088',
  bandHighFill: '#E4805F',
  bandHighSoft: '#341F18',

  positive: '#4FD3C2',
  destructive: '#F0917A',
  destructiveSoft: '#331C16',

  aurora: ['#2A1F55', '#123A38'],
  heat: ['#1C1828', '#153733', '#1C5A4E', '#5C4A22', '#87552F', '#B06A46'],

  gradients: {
    primary: { from: '#8B78FF', to: '#5E4BD8' },
    hero: { from: '#7B65F5', to: '#1E9E97' },
    low: { from: '#4FD3C2', to: '#189183' },
    elevated: { from: '#F2BC63', to: '#C88A22' },
    high: { from: '#F3A088', to: '#CC6E4F' },
    trend: { from: '#8B78FF', to: '#4FD3C2' },
  },

  shadow: '#000000',
};

export const palettes = { light, dark } as const;

export type ColorSchemeName = keyof typeof palettes;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** §11.5: every interactive target is at least 44x44pt. */
export const MIN_TOUCH_TARGET = 44;

export const typography = {
  hero: { fontSize: 52, fontWeight: '700' as const, letterSpacing: -1.4 },
  display: { fontSize: 38, fontWeight: '700' as const, letterSpacing: -0.9 },
  title: { fontSize: 27, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 19, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13.5, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.1 },
} as const;

/** Soft elevation. Kept subtle — this is not a material-design app. */
export function elevation(palette: Palette, level: 1 | 2 | 3) {
  const config = {
    1: { opacity: 0.05, radius: 10, offset: 3 },
    2: { opacity: 0.08, radius: 20, offset: 8 },
    3: { opacity: 0.12, radius: 32, offset: 14 },
  }[level];
  return {
    shadowColor: palette.shadow,
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.offset },
    elevation: level * 3,
  };
}

export interface BandStyle {
  label: string;
  /** Contrast-safe on surfaces. */
  text: string;
  /** For arcs, bars and dots. */
  fill: string;
  soft: string;
  gradient: Gradient;
  /** Plain language. No "warning", no "will", no exclamation mark (§13.1). */
  blurb: string;
}

export function bandStyle(band: RiskBand, palette: Palette): BandStyle {
  switch (band) {
    case 'high':
      return {
        label: 'High',
        text: palette.bandHighText,
        fill: palette.bandHighFill,
        soft: palette.bandHighSoft,
        gradient: palette.gradients.high,
        blurb:
          'Your last two weeks resemble the stretches that came before flares in the ' +
          'training data.',
      };
    case 'elevated':
      return {
        label: 'Elevated',
        text: palette.bandElevatedText,
        fill: palette.bandElevatedFill,
        soft: palette.bandElevatedSoft,
        gradient: palette.gradients.elevated,
        blurb: 'A few factors are drifting in a direction worth keeping an eye on.',
      };
    default:
      return {
        label: 'Low',
        text: palette.bandLowText,
        fill: palette.bandLowFill,
        soft: palette.bandLowSoft,
        gradient: palette.gradients.low,
        blurb: 'Nothing in your recent pattern stands out right now.',
      };
  }
}

/**
 * Colour ramp for the user's own 0-10 severity rating. Sequential and calm —
 * it tops out at coral, never red, so the check-in never feels like an alarm.
 */
export function severityGradient(value: number, palette: Palette): Gradient {
  if (value <= 3) return palette.gradients.low;
  if (value <= 6) return palette.gradients.elevated;
  return palette.gradients.high;
}

/** Plain-language gloss on a 0-10 self-rating. Not a clinical claim. */
export function severityWord(value: number): string {
  if (value === 0) return 'Clear';
  if (value <= 2) return 'Very mild';
  if (value <= 4) return 'Mild';
  if (value <= 6) return 'Moderate';
  if (value <= 8) return 'Bad';
  return 'Worst it gets';
}
