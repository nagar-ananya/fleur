/**
 * Theme access. The app is light-only (the "notebook" palette), whatever the
 * phone's system setting — one look keeps it simple to demo.
 */

import { palettes, type ColorSchemeName, type Palette } from '../theme';

export function useTheme(): { palette: Palette; scheme: ColorSchemeName } {
  return { palette: palettes.light, scheme: 'light' };
}
