/**
 * Reset → Breathwork session player.
 *
 * A modal, closed with an explicit X rather than a back arrow — this is the
 * one Reset screen the source design also treats as a focused, full-screen
 * player rather than a page in a stack.
 *
 * Only sessions with a real timed `pattern` (see `src/constants/reset.ts`)
 * get the animated ring; the rest get an honest "about this session" card
 * instead of a fabricated breathing pattern Fleur never authored.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { CloseIcon, PauseIcon, PlayIcon, WindIcon } from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import { BreathingRing } from '../src/components/reset-ui';
import { Button, Card, IconBadge, Screen, Txt } from '../src/components/primitives';
import { BREATH_SESSIONS } from '../src/constants/reset';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';

export default function BreathSessionScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const session = BREATH_SESSIONS.find((s) => s.id === params.id) ?? BREATH_SESSIONS[0];
  const [playing, setPlaying] = useState(true);
  const hasPattern = session.pattern.length > 0;

  return (
    <Screen aurora={false} contentStyle={{ paddingBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <PressableScale
          onPress={() => router.back()}
          accessibilityLabel="Close"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.surfaceAlt,
          }}
        >
          <CloseIcon size={18} color={palette.textMuted} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{session.title}</Txt>
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {`Breathwork · ${session.meta}`}
          </Txt>
        </View>
      </View>

      {hasPattern ? (
        <Reveal delay={80}>
          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <BreathingRing pattern={session.pattern} phaseLabels={session.phaseLabels} playing={playing} />
          </View>

          <PressableScale
            onPress={() => setPlaying((p) => !p)}
            accessibilityLabel={playing ? 'Pause session' : 'Resume session'}
            style={{
              marginTop: spacing.xxl,
              minHeight: 56,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: palette.primary,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.sm,
            }}
          >
            {playing ? (
              <PauseIcon size={18} color={palette.primary} />
            ) : (
              <PlayIcon size={18} color={palette.primary} />
            )}
            <Txt variant="label" tone="accent">
              {playing ? 'Pause session' : 'Resume session'}
            </Txt>
          </PressableScale>
        </Reveal>
      ) : (
        <Reveal delay={80}>
          <Card level={2} style={{ marginTop: spacing.xxl, alignItems: 'center', paddingVertical: spacing.xxl }}>
            <IconBadge background={palette.primarySoft} size={54}>
              <WindIcon size={24} color={palette.primary} />
            </IconBadge>
            <Txt variant="heading" style={{ marginTop: spacing.lg }} center>
              {session.title}
            </Txt>
            <Txt tone="muted" center style={{ marginTop: spacing.sm, lineHeight: 21 }}>
              This one is guided by feel rather than a fixed count — settle in, breathe evenly,
              and stop whenever it has done its job.
            </Txt>
          </Card>
          <Button label="Done" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
        </Reveal>
      )}

      <Txt variant="caption" tone="faint" style={{ marginTop: spacing.xxl, lineHeight: 19 }}>
        Not logged to your check-in. Breathwork is not a treatment — it targets whichever factor
        in your profile currently carries the most weight.
      </Txt>
    </Screen>
  );
}
