/**
 * Settings (REQUIREMENTS §11.1, FR-7.x) — v2 redesign.
 *
 * A navigational list into five dedicated sub-pages (Profile, Permissions,
 * Export, Model & disclaimer, Delete all data) — was a single page with
 * inline sections and modals. All the underlying logic (profile edits, CSV
 * export, delete confirmation) moved with its section rather than being
 * rewritten.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  ChevronRight,
  ExportIcon,
  PersonIcon,
  ShieldIcon,
  SparkIcon,
  TrashIcon,
} from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import { Card, IconBadge, Kicker, Screen, Txt } from '../../src/components/primitives';
import { countCheckInDays, deleteCheckIn } from '../../src/db/queries';
import { DEFAULT_SEED_DAYS, DEV_TOOLS_ENABLED, seedDemoCheckIns } from '../../src/dev/seed';
import { model, useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing } from '../../src/theme';
import { formatLong, todayLocal } from '../../src/utils/dates';

const ROWS = [
  { key: 'profile', title: 'Profile', icon: PersonIcon, path: '/settings-profile' as const, destructive: false },
  { key: 'permissions', title: 'Permissions', icon: ShieldIcon, path: '/settings-permissions' as const, destructive: false },
  { key: 'export', title: 'Export as CSV', icon: ExportIcon, path: '/settings-export' as const, destructive: false },
  { key: 'model', title: 'Model & disclaimer', icon: SparkIcon, path: '/settings-model' as const, destructive: false },
  { key: 'delete', title: 'Delete all data', icon: TrashIcon, path: '/settings-delete' as const, destructive: true },
] as const;

export default function SettingsScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { profile, db, refresh } = useApp();
  const [days, setDays] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (db) void countCheckInDays(db).then(setDays);
  }, [db]);

  const subtitleFor = (key: (typeof ROWS)[number]['key']): string | undefined => {
    switch (key) {
      case 'profile':
        return profile
          ? `${profile.psoriasisType} · ${profile.onSystemic ? 'on a biologic' : 'topicals only'}`
          : undefined;
      case 'export':
        return `${days} check-${days === 1 ? 'in' : 'ins'} logged`;
      case 'model':
        return `v${model.model_version} · trained ${model.trained_at.slice(0, 10)}`;
      case 'delete':
        return 'Irreversible · requires a typed confirmation';
      default:
        return undefined;
    }
  };

  /** Development only; see `src/dev/seed.ts`. */
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
      Alert.alert('Seeding failed', 'See the Metro logs for details.');
    } finally {
      setSeeding(false);
    }
  };

  const onClearToday = async (): Promise<void> => {
    if (!db) return;
    setClearing(true);
    try {
      const date = todayLocal();
      const removed = await deleteCheckIn(db, date);
      await refresh();
      setDays(await countCheckInDays(db));
      Alert.alert(
        removed ? "Today's check-in cleared" : 'Nothing to clear',
        removed
          ? `${formatLong(date)} is back to un-logged. Open Today to check in again.`
          : 'There was no check-in saved for today.',
      );
    } catch (error) {
      console.error('[fleur] could not clear today', error);
      Alert.alert('Could not clear', 'See the Metro logs for details.');
    } finally {
      setClearing(false);
    }
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
          {ROWS.map((row) => {
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
          })}
        </View>
      </Reveal>

      {/* Development only — `DEV_TOOLS_ENABLED` is `__DEV__`, so this whole
          block is absent from a release build. It exists because FR-4.2 hides
          the forecast until 14 days are logged while FR-2.4 caps back-fill at
          7, leaving the risk screens unreachable by hand on a fresh install. */}
      {DEV_TOOLS_ENABLED ? (
        <Reveal delay={130}>
          <Card style={{ marginTop: spacing.md, borderStyle: 'dashed', borderWidth: 1.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconBadge background={palette.aquaSoft}>
                <SparkIcon size={18} color={palette.aqua} />
              </IconBadge>
              <View style={{ flex: 1 }}>
                <Txt variant="heading">Developer tools</Txt>
                <Txt variant="caption" tone="faint" style={{ marginTop: 1 }}>
                  Not present in a release build
                </Txt>
              </View>
            </View>
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <PressableScale onPress={() => void onSeed()} accessibilityLabel="Seed demo data">
                <Txt variant="label" tone="accent">
                  {seeding ? 'Seeding…' : `Seed ${DEFAULT_SEED_DAYS} days of demo data`}
                </Txt>
              </PressableScale>
              <PressableScale onPress={() => void onClearToday()} accessibilityLabel="Clear today's check-in">
                <Txt variant="label" tone="accent">
                  {clearing ? 'Clearing…' : "Clear today's check-in"}
                </Txt>
              </PressableScale>
            </View>
          </Card>
        </Reveal>
      ) : null}

      <Txt variant="caption" tone="faint" center style={{ marginTop: spacing.xl }}>
        Fleur · experimental research prototype
      </Txt>
    </Screen>
  );
}
