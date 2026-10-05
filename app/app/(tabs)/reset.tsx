import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { BowlIcon, ChevronRight, DropletIcon, PersonMoveIcon, WindIcon } from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import { Card, IconBadge, Screen, ScreenTitle, Txt } from '../../src/components/primitives';
import { RESET_CATEGORIES, categoryPath, type ResetCategory } from '../../src/constants/reset';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, type Palette, type Tint } from '../../src/theme';

const CATEGORY_ICON: Record<
  ResetCategory['icon'],
  (props: { size: number; color: string }) => React.ReactElement
> = {
  wind: WindIcon,
  bowl: BowlIcon,
  move: PersonMoveIcon,
  drop: DropletIcon,
};

const CATEGORY_TINT: Record<ResetCategory['icon'], (palette: Palette) => Tint> = {
  wind: (palette) => palette.tints.sage,
  bowl: (palette) => palette.tints.butter,
  move: (palette) => palette.tints.lilac,
  drop: (palette) => palette.tints.sky,
};

export default function ResetScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <Reveal>
        <ScreenTitle title="Reset" subtitle="Small things you can do today." />
      </Reveal>

      <Reveal delay={70}>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {RESET_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICON[category.icon];
            const tint = CATEGORY_TINT[category.icon](palette);
            return (
              <PressableScale
                key={category.key}
                onPress={() => router.push(categoryPath(category.key) as never)}
                accessibilityLabel={category.title}
                scaleTo={0.98}
              >
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl }}>
                  <IconBadge background={tint.soft} size={56}>
                    <Icon size={26} color={tint.ink} />
                  </IconBadge>
                  <View style={{ flex: 1 }}>
                    <Txt variant="heading">{category.title}</Txt>
                    <Txt tone="muted" style={{ marginTop: 2 }}>
                      {category.subtitle}
                    </Txt>
                  </View>
                  <ChevronRight size={18} color={palette.textFaint} />
                </Card>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>
    </Screen>
  );
}
