/**
 * Reset → Wind-down → routine. Only "90-minute wind-down" is a real
 * five-step checklist (from the source design); the other rituals get an
 * honest summary card. Ticks persist for today via `useDailyChecklist`.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { MoonIcon } from '../src/components/icons';
import { Reveal } from '../src/components/motion';
import { Button, Card, IconBadge, Kicker, Screen, Txt } from '../src/components/primitives';
import { ChecklistRow } from '../src/components/reset-ui';
import { SLEEP_RITUALS, WIND_DOWN_STEPS } from '../src/constants/reset';
import { useDailyChecklist } from '../src/hooks/useDailyChecklist';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';
import { todayLocal } from '../src/utils/dates';

export default function SleepRoutineScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const ritual = SLEEP_RITUALS.find((r) => r.id === params.id) ?? SLEEP_RITUALS[0];
  const { done, toggle } = useDailyChecklist('wind-down', todayLocal());

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: ritual.title }} />
      <Reveal>
        <Txt variant="title">{ritual.title}</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          {`Wind-down · ${ritual.meta}`}
        </Txt>
      </Reveal>

      {ritual.flagship ? (
        <>
          <Reveal delay={90}>
            <Card style={{ marginTop: spacing.xl }}>
              <Txt variant="caption" tone="faint">
                Why 7.5 hours
              </Txt>
              <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 21 }}>
                The model carries a sleep-debt term: the shortfall against 7.5 hours a night,
                summed over seven days. Wind-down steps here are aimed squarely at that number.
              </Txt>
            </Card>
          </Reveal>
          <Reveal delay={150}>
            <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              Steps · tap to tick off
            </Kicker>
            {WIND_DOWN_STEPS.map((step) => (
              <ChecklistRow
                key={step.key}
                title={step.title}
                meta={step.meta}
                done={!!done[step.key]}
                onToggle={() => toggle(step.key)}
              />
            ))}
          </Reveal>
        </>
      ) : (
        <Reveal delay={90}>
          <Card style={{ marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.xl }}>
            <IconBadge background={palette.primarySoft} size={44}>
              <MoonIcon size={20} color={palette.primary} />
            </IconBadge>
            <Txt tone="muted" center style={{ marginTop: spacing.md, lineHeight: 21 }}>
              A shorter routine than tonight's flagship one — adapt the timing to whatever your
              evening actually looks like.
            </Txt>
          </Card>
        </Reveal>
      )}

      <Button label="Done" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
