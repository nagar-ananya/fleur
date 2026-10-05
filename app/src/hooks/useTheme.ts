import { palettes, type ColorSchemeName, type Palette } from '../theme';

export function useTheme(): { palette: Palette; scheme: ColorSchemeName } {
  return { palette: palettes.light, scheme: 'light' };
}
