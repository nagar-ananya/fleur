/**
 * Reset → Eat → recipe detail. Only "Turmeric & oat bowl" has real
 * ingredients and method (from the source design); the other five recipes
 * get an honest summary card instead of an invented recipe.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { BowlIcon } from '../src/components/icons';
import { Reveal } from '../src/components/motion';
import { Button, Card, IconBadge, Kicker, Pill, Screen, Txt } from '../src/components/primitives';
import { RECIPES, TURMERIC_INGREDIENTS, TURMERIC_METHOD } from '../src/constants/reset';
import { useTheme } from '../src/hooks/useTheme';
import { spacing, radius } from '../src/theme';

export default function RecipeScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const recipe = RECIPES.find((r) => r.id === params.id) ?? RECIPES[0];

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: recipe.title }} />
      <Reveal>
        <Txt variant="title">{recipe.title}</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          {`Eat · ${recipe.meta}`}
        </Txt>
      </Reveal>

      {recipe.tags ? (
        <Reveal delay={60}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
            {recipe.tags.map((tag) => (
              <Pill key={tag} label={tag} color={palette.primary} background={palette.primarySoft} />
            ))}
          </View>
        </Reveal>
      ) : null}

      {recipe.flagship ? (
        <>
          <Reveal delay={110}>
            <Kicker style={{ marginTop: spacing.xl }}>Ingredients</Kicker>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginTop: spacing.md,
              }}
            >
              {TURMERIC_INGREDIENTS.map((item) => (
                <Txt key={item} tone="muted" style={{ width: '50%', marginBottom: spacing.sm, lineHeight: 20 }}>
                  {item}
                </Txt>
              ))}
            </View>
          </Reveal>

          <Reveal delay={160}>
            <Kicker style={{ marginTop: spacing.md }}>Method</Kicker>
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              {TURMERIC_METHOD.map((step) => (
                <View key={step.n} style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Txt variant="caption" tone="accent" style={{ width: 16 }}>
                    {step.n}
                  </Txt>
                  <Txt tone="muted" style={{ flex: 1, lineHeight: 21 }}>
                    {step.t}
                  </Txt>
                </View>
              ))}
            </View>
          </Reveal>
        </>
      ) : (
        <Reveal delay={110}>
          <Card style={{ marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.xl }}>
            <IconBadge background={palette.primarySoft} size={44}>
              <BowlIcon size={20} color={palette.primary} />
            </IconBadge>
            <Txt tone="muted" center style={{ marginTop: spacing.md, lineHeight: 21 }}>
              Built around the same food factors as the rest of Eat — no dairy, no added sugar,
              little to no processed ingredients.
            </Txt>
          </Card>
        </Reveal>
      )}

      <Reveal delay={210}>
        <Card tone="alt" level={1} style={{ marginTop: spacing.xl, borderRadius: radius.lg }}>
          <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
            No diet has been shown to clear psoriasis. This is here because sugar and processed
            food are two of the things you log, so eating around them keeps those inputs clean.
          </Txt>
        </Card>
      </Reveal>

      <Button label="Done" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
