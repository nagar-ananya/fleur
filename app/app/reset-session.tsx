/**
 * Reset → Breathing → one exercise. A full-screen player (closed with X):
 * the breathing ring paces each breath, a countdown shows time left, and a
 * single chime marks the end.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { CloseIcon } from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import { BreathingRing } from '../src/components/reset-ui';
import { Button, Screen, Txt } from '../src/components/primitives';
import { BREATH_EXERCISES } from '../src/constants/reset';
import { useAlarm } from '../src/hooks/useAlarm';
import { formatClock, useCountdown } from '../src/hooks/useCountdown';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';

export default function BreathSessionScreen(): React.ReactElement {
  useKeepAwake();
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const exercise = BREATH_EXERCISES.find((s) => s.id === params.id) ?? BREATH_EXERCISES[0];
  const clock = useCountdown(exercise.minutes * 60);
  const alarm = useAlarm();

  useEffect(() => {
    if (clock.done) alarm.ring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.done]);

  return (
    <Screen aurora={false} contentStyle={{ paddingBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <PressableScale
          onPress={() => router.back()}
          accessibilityLabel="Close"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.surfaceAlt,
          }}
        >
          <CloseIcon size={18} color={palette.textMuted} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{exercise.title}</Txt>
          <Txt tone="muted" style={{ marginTop: 2 }}>
            {exercise.meta}
          </Txt>
        </View>
      </View>

      <Reveal delay={80}>
        <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
          {clock.done ? (
            <View style={{ height: 260, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="display" style={{ color: palette.bandLowText }}>
                Nice work
              </Txt>
              <Txt tone="muted" style={{ marginTop: spacing.sm }}>
                {`${exercise.minutes} minutes done`}
              </Txt>
            </View>
          ) : (
            <BreathingRing pattern={exercise.pattern} phaseLabels={exercise.phaseLabels} playing={clock.running} />
          )}
        </View>

        {!clock.done ? (
          <Txt
            variant="title"
            center
            tone="muted"
            style={{ marginTop: spacing.xl, fontVariant: ['tabular-nums'] }}
          >
            {`${formatClock(clock.secondsLeft)} left`}
          </Txt>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          {clock.done ? (
            <>
              <Button label="Again" variant="secondary" onPress={clock.restart} style={{ flex: 1 }} />
              <Button label="Finish" onPress={() => router.back()} style={{ flex: 1 }} />
            </>
          ) : (
            <Button
              label={clock.running ? 'Pause' : 'Resume'}
              variant="secondary"
              onPress={clock.running ? clock.pause : clock.resume}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Reveal>
    </Screen>
  );
}
