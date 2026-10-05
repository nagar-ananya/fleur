import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Reveal } from '../src/components/motion';
import { Card, Kicker, NumberCircle, Screen, Txt } from '../src/components/primitives';
import { RECIPES } from '../src/constants/reset';
import { spacing } from '../src/theme';

export default function RecipeScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ id?: string }>();
  const recipe = RECIPES.find((r) => r.id === params.id) ?? RECIPES[0];

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: 'Recipe' }} />
      <Reveal>
        <Txt variant="title">{recipe.title}</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          {recipe.meta}
        </Txt>
      </Reveal>

      <Reveal delay={60}>
        <Card style={{ marginTop: spacing.xl }}>
          <Kicker style={{ marginBottom: spacing.sm }}>You need</Kicker>
          {recipe.ingredients.map((item) => (
            <View key={item} style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: 4 }}>
              <Txt tone="faint">•</Txt>
              <Txt style={{ flex: 1 }}>{item}</Txt>
            </View>
          ))}
        </Card>
      </Reveal>

      <Reveal delay={110}>
        <Card style={{ marginTop: spacing.md }}>
          <Kicker style={{ marginBottom: spacing.sm }}>Steps</Kicker>
          {recipe.steps.map((step, i) => (
            <View key={step} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm }}>
              <NumberCircle value={i + 1} size={26} />
              <Txt style={{ flex: 1, lineHeight: 22 }}>{step}</Txt>
            </View>
          ))}
        </Card>
      </Reveal>
    </Screen>
  );
}
