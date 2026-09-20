/**
 * Theme access. §11.5 requires both light and dark on every screen, so the
 * palette is resolved from the OS scheme rather than hardcoded anywhere.
 */

import { useColorScheme } from 'react-native';

import { palettes, type ColorSchemeName, type Palette } from '../theme';

export function useTheme(): { palette: Palette; scheme: ColorSchemeName } {
  const scheme: ColorSchemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { palette: palettes[scheme], scheme };
}
