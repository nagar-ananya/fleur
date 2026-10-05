import type { RiskBand } from './types/models';

export interface Gradient {
  readonly from: string;
  readonly to: string;
}

export interface Tint {
  readonly ink: string;
  readonly soft: string;
}

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textFaint: string;
  onAccent: string;

  primary: string;
  primaryDeep: string;
  primarySoft: string;
  aqua: string;
  aquaSoft: string;

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
  destructive: string;
  destructiveSoft: string;

  tints: {
    sage: Tint;
    butter: Tint;
    lilac: Tint;
    sky: Tint;
  };

  aurora: readonly [string, string];
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

// Colors. No red anywhere near the risk score, the top band is orange.
const light: Palette = {
  background: '#FFFFFF',
  surface: '#F4F2F6',
  surfaceAlt: '#EAE6EE',
  surfaceSunken: '#E0DBE5',
  border: '#E4E0E8',
  borderStrong: '#CBC5D1',

  text: '#1E1A22',
  textMuted: '#544E5A',
  textFaint: '#625C68',
  onAccent: '#FFFFFF',

  primary: '#8E44AD',
  primaryDeep: '#6C3483',
  primarySoft: '#F2E7F7',
  aqua: '#137262',
  aquaSoft: '#DDF2EC',

  bandLowText: '#1D7447',
  bandLowFill: '#52B77A',
  bandLowSoft: '#E2F4E8',
  bandElevatedText: '#875700',
  bandElevatedFill: '#F2B33D',
  bandElevatedSoft: '#FDF0D3',
  bandHighText: '#AF4527',
  bandHighFill: '#EE7D57',
  bandHighSoft: '#FDE4DA',

  positive: '#1D7447',
  destructive: '#A8352A',
  destructiveSoft: '#FBE1DC',

  tints: {
    sage: { ink: '#22704F', soft: '#E0F2E7' },
    butter: { ink: '#80590A', soft: '#FCF0CF' },
    lilac: { ink: '#6A44A8', soft: '#EEE6FA' },
    sky: { ink: '#22668F', soft: '#E0EEF8' },
  },

  aurora: ['#FFFFFF', '#FFFFFF'],
  heat: ['#EEECF0', '#D7F0E0', '#ABDDBE', '#F8DE9C', '#F5B595', '#EA8A6A'],

  gradients: {
    primary: { from: '#8E44AD', to: '#8E44AD' },
    hero: { from: '#8E44AD', to: '#8E44AD' },
    low: { from: '#52B77A', to: '#52B77A' },
    elevated: { from: '#F2B33D', to: '#F2B33D' },
    high: { from: '#EE7D57', to: '#EE7D57' },
    trend: { from: '#8E44AD', to: '#8E44AD' },
  },

  shadow: '#000000',
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

  tints: {
    sage: { ink: '#9ED9C0', soft: '#173229' },
    butter: { ink: '#F2CF7E', soft: '#33280F' },
    lilac: { ink: '#C9B5F0', soft: '#2A2140' },
    sky: { ink: '#9CCBEA', soft: '#14293A' },
  },

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
  sm: 6,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 999,
} as const;

export const MIN_TOUCH_TARGET = 44;

// Text sizes.
export const typography = {
  hero: { fontSize: 56, fontWeight: '700' as const },
  display: { fontSize: 30, fontWeight: '700' as const },
  title: { fontSize: 23, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 14, fontWeight: '400' as const },
  micro: { fontSize: 12, fontWeight: '600' as const },
} as const;

export interface BandStyle {
  label: string;
  text: string;
  fill: string;
  soft: string;
  gradient: Gradient;
  blurb: string;
}

// Color and label for each risk band.
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
          'Several of the rules are adding points at once, which is when flares are ' +
          'most likely.',
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

export function severityGradient(value: number, palette: Palette): Gradient {
  if (value <= 3) return palette.gradients.low;
  if (value <= 6) return palette.gradients.elevated;
  return palette.gradients.high;
}

export function severityWord(value: number): string {
  if (value === 0) return 'Clear';
  if (value <= 2) return 'Very mild';
  if (value <= 4) return 'Mild';
  if (value <= 6) return 'Moderate';
  if (value <= 8) return 'Bad';
  return 'Worst it gets';
}
