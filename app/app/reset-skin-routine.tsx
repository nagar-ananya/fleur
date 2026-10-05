import { Stack } from 'expo-router';
import React from 'react';

import { Reveal } from '../src/components/motion';
import { Kicker, Screen, Txt } from '../src/components/primitives';
import { ChecklistRow } from '../src/components/reset-ui';
import { SKIN_AM_STEPS, SKIN_PM_STEPS, type ChecklistItem } from '../src/constants/reset';
import { useDailyChecklist } from '../src/hooks/useDailyChecklist';
import { spacing } from '../src/theme';
import { todayLocal } from '../src/utils/dates';

export default function SkinRoutineScreen(): React.ReactElement {
  const { done, toggle } = useDailyChecklist('skin-routine', todayLocal());
  const all = [...SKIN_AM_STEPS, ...SKIN_PM_STEPS];
  const count = all.filter((s) => done[s.key]).length;

  const section = (title: string, steps: readonly ChecklistItem[]): React.ReactElement => (
    <>
      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>{title}</Kicker>
      {steps.map((step) => (
        <ChecklistRow
          key={step.key}
          title={step.title}
          done={!!done[step.key]}
          onToggle={() => toggle(step.key)}
        />
      ))}
    </>
  );

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: "Today's skin routine" }} />
      <Reveal>
        <Txt tone="muted">{`${count} of ${all.length} done today`}</Txt>
      </Reveal>
      <Reveal delay={60}>{section('Morning', SKIN_AM_STEPS)}</Reveal>
      <Reveal delay={110}>{section('Evening', SKIN_PM_STEPS)}</Reveal>
    </Screen>
  );
}
