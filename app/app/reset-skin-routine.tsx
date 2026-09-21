/**
 * Reset → Skin → today's routine. Morning and night checklists, ticks
 * persisted for today via `useDailyChecklist`. Explicitly not adherence
 * logging — that lives in the check-in's "Took my treatment" toggle.
 */

import { Stack, useRouter } from 'expo-router';
import React from 'react';

import { Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { ChecklistRow } from '../src/components/reset-ui';
import { SKIN_AM_STEPS, SKIN_PM_STEPS } from '../src/constants/reset';
import { useDailyChecklist } from '../src/hooks/useDailyChecklist';
import { spacing, radius } from '../src/theme';
import { formatLong, todayLocal } from '../src/utils/dates';

export default function SkinRoutineScreen(): React.ReactElement {
  const router = useRouter();
  const today = todayLocal();
  const { done, toggle } = useDailyChecklist('skin-routine', today);

  const amDone = SKIN_AM_STEPS.filter((s) => done[s.key]).length;
  const pmDone = SKIN_PM_STEPS.filter((s) => done[s.key]).length;

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: "Today's routine" }} />
      <Reveal>
        <Txt variant="title">Today's routine</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          {`${formatLong(today)} · ${amDone + pmDone} of ${SKIN_AM_STEPS.length + SKIN_PM_STEPS.length} steps`}
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Morning</Kicker>
        {SKIN_AM_STEPS.map((step) => (
          <ChecklistRow
            key={step.key}
            title={step.title}
            meta={step.meta}
            done={!!done[step.key]}
            onToggle={() => toggle(step.key)}
          />
        ))}
      </Reveal>

      <Reveal delay={130}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Night</Kicker>
        {SKIN_PM_STEPS.map((step) => (
          <ChecklistRow
            key={step.key}
            title={step.title}
            meta={step.meta}
            done={!!done[step.key]}
            onToggle={() => toggle(step.key)}
          />
        ))}
      </Reveal>

      <Reveal delay={190}>
        <Card tone="alt" level={1} style={{ marginTop: spacing.xl, borderRadius: radius.lg }}>
          <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
            Ticking a step here does not log medication adherence — that lives in the check-in,
            where the model reads it.
          </Txt>
        </Card>
      </Reveal>

      <Button label="Done" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
