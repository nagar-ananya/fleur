/**
 * Reset → one list: breathing exercises, recipes or movement timers. Each
 * row opens its player, recipe or timer.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ChevronRight } from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import { Card, Screen, Txt } from '../src/components/primitives';
import {
  BREATH_EXERCISES,
  MOVE_TIMERS,
  RECIPES,
  RESET_CATEGORIES,
  type ResetCategoryKey,
} from '../src/constants/reset';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';

interface Item {
  id: string;
  title: string;
  meta: string;
  pathname: '/reset-session' | '/reset-recipe' | '/reset-movement';
}

function itemsFor(key: ResetCategoryKey): Item[] {
  switch (key) {
    case 'breath':
      return BREATH_EXERCISES.map((b) => ({
        id: b.id,
        title: b.title,
        meta: `${b.minutes} min · ${b.meta}`,
        pathname: '/reset-session',
      }));
    case 'eat':
      return RECIPES.map((r) => ({ id: r.id, title: r.title, meta: r.meta, pathname: '/reset-recipe' }));
    default:
      return MOVE_TIMERS.map((m) => ({
        id: m.id,
        title: m.title,
        meta: `${m.minutes} min timer`,
        pathname: '/reset-movement',
      }));
  }
}

export default function ResetCategoryScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string }>();
  const category = RESET_CATEGORIES.find((c) => c.key === params.key) ?? RESET_CATEGORIES[0];

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: category.title }} />
      <Reveal>
        <View style={{ gap: spacing.md }}>
          {itemsFor(category.key).map((item) => (
            <PressableScale
              key={item.id}
              onPress={() => router.push({ pathname: item.pathname, params: { id: item.id } })}
              accessibilityLabel={`${item.title}, ${item.meta}`}
              scaleTo={0.98}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">{item.title}</Txt>
                  <Txt tone="muted" style={{ marginTop: 2 }}>
                    {item.meta}
                  </Txt>
                </View>
                <ChevronRight size={18} color={palette.textFaint} />
              </Card>
            </PressableScale>
          ))}
        </View>
      </Reveal>
    </Screen>
  );
}
