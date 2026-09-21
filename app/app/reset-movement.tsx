/**
 * Reset → Movement session. Only the flagship "Evening unwind flow" carries a
 * real step sequence (from the source design); the other five sessions get
 * an honest overview card rather than an invented pose-by-pose routine.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { PauseIcon, PersonMoveIcon, PlayIcon } from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import { Button, Card, IconBadge, Kicker, Screen, Txt } from '../src/components/primitives';
import { MOVE_SESSIONS, YOGA_STEPS } from '../src/constants/reset';
import { useTheme } from '../src/hooks/useTheme';
import { spacing, radius } from '../src/theme';

export default function MovementSessionScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const session = MOVE_SESSIONS.find((s) => s.id === params.id) ?? MOVE_SESSIONS[0];
  const [playing, setPlaying] = useState(false);

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: session.title }} />
      <Reveal>
        <Txt variant="title">{session.title}</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          {`Movement · ${session.meta}`}
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <Card
          level={2}
          style={{ marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.xxl }}
        >
          <PressableScale
            onPress={() => setPlaying((p) => !p)}
            accessibilityLabel={playing ? 'Pause' : 'Start'}
            style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              borderWidth: 1,
              borderColor: palette.primary,
              backgroundColor: palette.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {playing ? (
              <PauseIcon size={24} color={palette.primary} />
            ) : (
              <PlayIcon size={24} color={palette.primary} />
            )}
          </PressableScale>
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md }}>
            {playing ? 'In progress' : 'Tap to begin'}
          </Txt>
        </Card>
      </Reveal>

      {session.flagship ? (
        <Reveal delay={130}>
          <Kicker style={{ marginTop: spacing.xl }}>Sequence</Kicker>
          <View style={{ marginTop: spacing.md }}>
            {YOGA_STEPS.map((step) => (
              <View
                key={step.n}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                }}
              >
                <Txt variant="caption" tone="accent" style={{ width: 22 }}>
                  {step.n}
                </Txt>
                <Txt style={{ flex: 1 }}>{step.t}</Txt>
                <Txt variant="caption" tone="faint">
                  {step.d}
                </Txt>
              </View>
            ))}
          </View>
        </Reveal>
      ) : (
        <Reveal delay={130}>
          <Card style={{ marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.xl }}>
            <IconBadge background={palette.primarySoft} size={44}>
              <PersonMoveIcon size={20} color={palette.primary} />
            </IconBadge>
            <Txt tone="muted" center style={{ marginTop: spacing.md, lineHeight: 21 }}>
              Move at your own pace for the length above. There is no fixed sequence for this
              one — follow what your body allows today.
            </Txt>
          </Card>
        </Reveal>
      )}

      <Reveal delay={190}>
        <Card
          tone="alt"
          level={1}
          style={{ marginTop: spacing.xl, borderRadius: radius.lg }}
        >
          <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
            Stop if anything pulls on a plaque or a fissure. Friction and stretching over broken
            skin are the Koebner route, and skin injury is one of the factors in your profile.
          </Txt>
        </Card>
      </Reveal>

      <Button label="Done" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
