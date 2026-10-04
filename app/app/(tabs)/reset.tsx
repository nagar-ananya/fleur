/**
 * Reset — four lists of small things to do today: breathing, eating,
 * movement and a skin-care checklist. Each opens its own list or checklist.
 * Not treatment (§2); see `src/constants/reset.ts`.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { BowlIcon, ChevronRight, DropletIcon, PersonMoveIcon, WindIcon } from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import { Card, IconBadge, Screen, Txt } from '../../src/components/primitives';
import { RESET_CATEGORIES, categoryPath, type ResetCategory } from '../../src/constants/reset';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing } from '../../src/theme';

const CATEGORY_ICON: Record<
  ResetCategory['icon'],
  (props: { size: number; color: string }) => React.ReactElement
> = {
  wind: WindIcon,
  bowl: BowlIcon,
  move: PersonMoveIcon,
  drop: DropletIcon,
};

export default function ResetScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Txt variant="display">Reset</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.sm }}>
          Small things you can do today.
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {RESET_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICON[category.icon];
            return (
              <PressableScale
                key={category.key}
                onPress={() => router.push(categoryPath(category.key) as never)}
                accessibilityLabel={category.title}
                scaleTo={0.98}
              >
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl }}>
                  <IconBadge background={palette.primarySoft} size={52}>
                    <Icon size={24} color={palette.primary} />
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
