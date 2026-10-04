/**
 * Settings (REQUIREMENTS §11.1, FR-7.x) — v2 redesign.
 *
 * A list of sub-pages (Profile, Export, AI second opinion, Scoring &
 * disclaimer, Delete all data), plus "Clear today's check-in" and the hidden
 * developer tools.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  ChevronRight,
  CloseIcon,
  ExportIcon,
  PersonIcon,
  SparkIcon,
  TrashIcon,
} from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import { Card, IconBadge, Kicker, Screen, Txt } from '../../src/components/primitives';
import { countCheckInDays, deleteCheckIn, getMeta, setMeta } from '../../src/db/queries';
import {
  DEFAULT_SEED_DAYS,
  DEV_MODE_KEY,
  DEV_MODE_TAPS,
  DEV_TOOLS_ENABLED,
  seedDemoCheckIns,
} from '../../src/dev/seed';
import { rulebook, useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing } from '../../src/theme';
import { todayLocal } from '../../src/utils/dates';

const ROWS = [
  { key: 'profile', title: 'Profile', icon: PersonIcon, path: '/settings-profile' as const, destructive: false },
  { key: 'export', title: 'Export', icon: ExportIcon, path: '/settings-export' as const, destructive: false },
  { key: 'ai', title: 'AI second opinion', icon: SparkIcon, path: '/settings-ai' as const, destructive: false },
  { key: 'model', title: 'Scoring & disclaimer', icon: SparkIcon, path: '/settings-model' as const, destructive: false },
  { key: 'delete', title: 'Delete all data', icon: TrashIcon, path: '/settings-delete' as const, destructive: true },
] as const;

export default function SettingsScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { profile, db, refresh } = useApp();
  const [days, setDays] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [devMode, setDevMode] = useState(DEV_TOOLS_ENABLED);
  const taps = useRef({ count: 0, last: 0 });

  useEffect(() => {
    if (!db) return;
    void countCheckInDays(db).then(setDays);
    void getMeta(db, DEV_MODE_KEY).then((value) => {
      if (value !== null) setDevMode(value === '1');
    });
  }, [db]);

  /** Tapping the footer `DEV_MODE_TAPS` times in quick succession toggles developer mode. */
  const onFooterTap = (): void => {
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.last < 1500 ? t.count + 1 : 1;
    t.last = now;
    if (t.count < DEV_MODE_TAPS || !db) return;
    t.count = 0;
    const next = !devMode;
    setDevMode(next);
    void setMeta(db, DEV_MODE_KEY, next ? '1' : '0');
    Alert.alert(next ? 'Developer mode on' : 'Developer mode off');
  };

  const confirmSeed = (): void => {
    Alert.alert(
      `Seed ${DEFAULT_SEED_DAYS} days of demo data?`,
      `This replaces any check-ins from the last ${DEFAULT_SEED_DAYS} days, including today.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Seed', style: 'destructive', onPress: () => void onSeed() },
      ],
    );
  };

  const subtitleFor = (key: (typeof ROWS)[number]['key']): string | undefined => {
    switch (key) {
      case 'profile':
        return profile
          ? `${profile.psoriasisType} · ${profile.onSystemic ? 'on a biologic' : 'topicals only'}`
          : undefined;
      case 'export':
        return `Save your ${days} check-${days === 1 ? 'in' : 'ins'} as a CSV file`;
      case 'ai':
        return 'TypeSafe · preview';
      case 'model':
        return `How the ${rulebook.rules.length} rules are scored`;
      case 'delete':
        return 'Irreversible · requires a typed confirmation';
      default:
        return undefined;
    }
  };

  /** Developer mode only; see `src/dev/seed.ts`. */
  const onSeed = async (): Promise<void> => {
    if (!db) return;
    setSeeding(true);
    try {
      const result = await seedDemoCheckIns(db);
      await refresh();
      setDays(await countCheckInDays(db));
      Alert.alert(
        'Demo data written',
        `${result.days} days of check-ins from ${result.from} to ${result.to}. ` +
          'Open Today to see the forecast.',
      );
    } catch (error) {
      console.error('[fleur] seeding failed', error);
      Alert.alert('Seeding failed', 'Something went wrong. Please try again.');
    } finally {
      setSeeding(false);
    }
  };

  const confirmClearToday = (): void => {
    Alert.alert("Clear today's check-in?", 'Your answers for today will be removed so you can start again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void onClearToday() },
    ]);
  };

  const onClearToday = async (): Promise<void> => {
    if (!db) return;
    setClearing(true);
    try {
      await deleteCheckIn(db, todayLocal());
      await refresh();
      setDays(await countCheckInDays(db));
    } catch (error) {
      console.error('[fleur] could not clear today', error);
      Alert.alert('Could not clear', 'Something went wrong. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const renderRow = (row: (typeof ROWS)[number]): React.ReactElement => {
    const Icon = row.icon;
    return (
      <PressableScale
        key={row.key}
        onPress={() => router.push(row.path)}
        accessibilityLabel={row.title}
        scaleTo={0.99}
        style={{ marginBottom: spacing.sm }}
      >
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBadge background={row.destructive ? palette.destructiveSoft : palette.surfaceAlt}>
            <Icon size={18} color={row.destructive ? palette.destructive : palette.textMuted} />
          </IconBadge>
          <View style={{ flex: 1 }}>
            <Txt variant="label" style={row.destructive ? { color: palette.destructive } : undefined}>
              {row.title}
            </Txt>
            {subtitleFor(row.key) ? (
              <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
                {subtitleFor(row.key)}
              </Txt>
            ) : null}
          </View>
          <ChevronRight size={17} color={palette.textFaint} />
        </Card>
      </PressableScale>
    );
  };

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>Preferences</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          Settings
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <View style={{ marginTop: spacing.lg }}>
          {ROWS.filter((row) => !row.destructive).map(renderRow)}

          <PressableScale
            onPress={confirmClearToday}
            accessibilityLabel="Clear today's check-in"
            scaleTo={0.99}
            style={{ marginBottom: spacing.sm }}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconBadge background={palette.surfaceAlt}>
                <CloseIcon size={16} color={palette.textMuted} />
              </IconBadge>
              <View style={{ flex: 1 }}>
                <Txt variant="label">{clearing ? 'Clearing…' : "Clear today's check-in"}</Txt>
                <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
                  Start today's answers over
                </Txt>
              </View>
              <ChevronRight size={17} color={palette.textFaint} />
            </Card>
          </PressableScale>

          {ROWS.filter((row) => row.destructive).map(renderRow)}
        </View>
      </Reveal>

      {/* Developer mode only (on by default in development builds; toggled by
          tapping the footer in release). It exists because FR-4.2 hides the
          forecast until 14 days are logged while FR-2.4 caps back-fill at 7,
          leaving the risk screens unreachable by hand on a fresh install. */}
      {devMode ? (
        <Reveal delay={130}>
          <Card style={{ marginTop: spacing.md, borderStyle: 'dashed', borderWidth: 1.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconBadge background={palette.aquaSoft}>
                <SparkIcon size={18} color={palette.aqua} />
              </IconBadge>
              <View style={{ flex: 1 }}>
                <Txt variant="heading">Developer tools</Txt>
                <Txt variant="caption" tone="faint" style={{ marginTop: 1 }}>
                  {`Tap the line below ${DEV_MODE_TAPS} times to hide`}
                </Txt>
              </View>
            </View>
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <PressableScale onPress={confirmSeed} accessibilityLabel="Seed demo data">
                <Txt variant="label" tone="accent">
                  {seeding ? 'Seeding…' : `Seed ${DEFAULT_SEED_DAYS} days of demo data`}
                </Txt>
              </PressableScale>
            </View>
          </Card>
        </Reveal>
      ) : null}

      <Pressable onPress={onFooterTap} style={{ marginTop: spacing.xl, paddingVertical: spacing.sm }}>
        <Txt variant="caption" tone="faint" center>
          Fleur · experimental research prototype
        </Txt>
      </Pressable>
    </Screen>
  );
}
