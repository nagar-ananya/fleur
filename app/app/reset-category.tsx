/**
 * Reset → one category's list (Movement, Breathwork, Eat, Wind-down) or, for
 * Skin and Mood, the category's own richer layout — see comments below.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { TrendChart } from '../src/components/charts';
import {
  BowlIcon,
  DropletIcon,
  MoonIcon,
  NotebookIcon,
  PersonMoveIcon,
  WindIcon,
} from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import { Card, IconBadge, Kicker, Pill, Screen, Txt } from '../src/components/primitives';
import { SessionRow } from '../src/components/reset-ui';
import {
  BREATH_SESSIONS,
  MOOD_ITEMS,
  MOVE_SESSIONS,
  RECIPES,
  RESET_CATEGORY_BY_KEY,
  SKIN_NOTES,
  SLEEP_RITUALS,
  type ResetCategoryKey,
} from '../src/constants/reset';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';
import { addDays, todayLocal } from '../src/utils/dates';
import { listCheckIns } from '../src/db/queries';

const ICON = {
  move: PersonMoveIcon,
  wind: WindIcon,
  bowl: BowlIcon,
  moon: MoonIcon,
  drop: DropletIcon,
  notebook: NotebookIcon,
} as const;

export default function ResetCategoryScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string }>();
  const key = (params.key ?? 'move') as ResetCategoryKey;
  const category = RESET_CATEGORY_BY_KEY[key] ?? RESET_CATEGORY_BY_KEY.move;
  const Icon = ICON[category.icon];

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Stack.Screen options={{ title: category.name }} />
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBadge background={palette.primarySoft} size={44}>
            <Icon size={21} color={palette.primary} />
          </IconBadge>
          <View style={{ flex: 1 }}>
            <Txt variant="title">{category.name}</Txt>
            <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
              {`${category.kicker} · ${category.meta}`}
            </Txt>
          </View>
        </View>
        <Txt tone="muted" style={{ marginTop: spacing.lg, lineHeight: 22 }}>
          {category.blurb}
        </Txt>
      </Reveal>

      {key === 'skin' ? <SkinBody /> : key === 'mood' ? <MoodBody /> : null}

      {key === 'move' || key === 'breath' || key === 'eat' || key === 'sleep' ? (
        <Reveal delay={90}>
          <View style={{ marginTop: spacing.xl }}>
            {(key === 'move'
              ? MOVE_SESSIONS.map((s) => ({ ...s, path: '/reset-movement' as const }))
              : key === 'breath'
                ? BREATH_SESSIONS.map((s) => ({ ...s, path: '/reset-session' as const }))
                : key === 'eat'
                  ? RECIPES.map((s) => ({ ...s, path: '/reset-recipe' as const }))
                  : SLEEP_RITUALS.map((s) => ({ ...s, path: '/reset-sleep-routine' as const }))
            ).map((item) => (
              <SessionRow
                key={item.id}
                icon={<Icon size={19} color={palette.primary} />}
                title={item.title}
                meta={item.meta}
                tag={item.flagship ? "IN TODAY'S PLAN" : undefined}
                onPress={() => router.push({ pathname: item.path, params: { id: item.id } })}
              />
            ))}
          </View>
        </Reveal>
      ) : null}
    </Screen>
  );
}

/** Skin gets its own routine entry point plus static handling notes, not a session list. */
function SkinBody(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  return (
    <>
      <Reveal delay={80}>
        <PillButton
          title="Open today's routine"
          subtitle="Morning and night, six steps"
          onPress={() => router.push('/reset-skin-routine')}
        />
      </Reveal>
      <Reveal delay={130}>
        <Kicker style={{ marginTop: spacing.xl }}>Handle with care</Kicker>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {SKIN_NOTES.map((note) => (
            <View key={note} style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ width: 2, borderRadius: 1, backgroundColor: palette.primary, marginTop: 4 }} />
              <Txt tone="muted" style={{ flex: 1, lineHeight: 21 }}>
                {note}
              </Txt>
            </View>
          ))}
        </View>
      </Reveal>
      <Reveal delay={180}>
        <Card tone="alt" style={{ marginTop: spacing.xl }}>
          <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
            Never start, stop or change a medication because of something you read here. Bring
            the log to your dermatologist instead.
          </Txt>
        </Card>
      </Reveal>
    </>
  );
}

/** Mood shows the real 14-day stress trend, then the journal entry points. */
function MoodBody(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db } = useApp();
  const [points, setPoints] = React.useState<{ date: string; value: number | null }[]>([]);

  React.useEffect(() => {
    if (!db) return;
    const today = todayLocal();
    const from = addDays(today, -13);
    void listCheckIns(db, from, today).then((rows) => {
      const byDate = new Map(rows.map((r) => [r.date, r.stress]));
      const window = Array.from({ length: 14 }, (_, i) => addDays(from, i));
      setPoints(window.map((date) => ({ date, value: byDate.get(date) ?? null })));
    });
  }, [db]);

  const logged = points.filter((p) => p.value !== null);
  const mean = logged.length
    ? logged.reduce((total, p) => total + (p.value ?? 0), 0) / logged.length
    : null;

  return (
    <>
      {logged.length > 1 ? (
        <Reveal delay={80}>
          <Card style={{ marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="micro" tone="faint" style={{ textTransform: 'uppercase' }}>
                Stress · last 14 days
              </Txt>
              {mean !== null ? (
                <Txt variant="caption" tone="faint">{`mean ${mean.toFixed(1)}`}</Txt>
              ) : null}
            </View>
            <TrendChart points={points} height={90} gradient={palette.gradients.elevated} showDots={false} />
          </Card>
        </Reveal>
      ) : null}
      <Reveal delay={130}>
        <View style={{ marginTop: spacing.xl }}>
          {MOOD_ITEMS.map((item) => (
            <SessionRow
              key={item.id}
              icon={<NotebookIcon size={19} color={palette.primary} />}
              title={item.title}
              meta={item.meta}
              tag={item.flagship ? 'NEW' : undefined}
              onPress={() => router.push({ pathname: '/reset-journal', params: { id: item.id } })}
            />
          ))}
        </View>
      </Reveal>
    </>
  );
}

function PillButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} scaleTo={0.99}>
      <Card
        level={2}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderColor: palette.primary,
        }}
      >
        <IconBadge background={palette.primarySoft}>
          <DropletIcon size={19} color={palette.primary} />
        </IconBadge>
        <View style={{ flex: 1 }}>
          <Txt variant="label">{title}</Txt>
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        </View>
        <Pill label="Open" color={palette.primary} background={palette.primarySoft} />
      </Card>
    </PressableScale>
  );
}
