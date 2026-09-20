/**
 * Settings (REQUIREMENTS §11.1, FR-7.x).
 *
 * FR-7.1: edit profile, manage permissions, export CSV, delete all data,
 * view disclaimer, view model version.
 */

import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Share, TextInput, View } from 'react-native';

import { ChoiceRow, ToggleRow } from '../../src/components/inputs';
import {
  ChevronRight,
  ExportIcon,
  InfoIcon,
  PersonIcon,
  PinIcon,
  PulseIcon,
  ShieldIcon,
  SparkIcon,
  TrashIcon,
} from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import {
  Button,
  Card,
  Divider,
  IconBadge,
  Kicker,
  Screen,
  Txt,
} from '../../src/components/primitives';
import { HEALTH_ENABLED, REQUESTED_SCOPES } from '../../src/api/health';
import { DISCLAIMER_FULL } from '../../src/constants/copy';
import {
  countCheckInDays,
  deleteCheckIn,
  exportCsv,
  saveProfile,
} from '../../src/db/queries';
import {
  DEFAULT_SEED_DAYS,
  DEV_TOOLS_ENABLED,
  seedDemoCheckIns,
} from '../../src/dev/seed';
import { model, useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { radius, spacing } from '../../src/theme';
import { formatLong, todayLocal } from '../../src/utils/dates';
import {
  PSORIASIS_TYPES,
  PSORIASIS_TYPE_LABELS,
  type Profile,
  type PsoriasisType,
} from '../../src/types/models';

const CONFIRM_PHRASE = 'DELETE';

export default function SettingsScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { profile, db, setProfile, deleteAllData, refresh } = useApp();
  const [days, setDays] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (db) void countCheckInDays(db).then(setDays);
    void Location.getForegroundPermissionsAsync().then(({ status }) =>
      setLocationGranted(status === 'granted'),
    );
  }, [db]);

  const updateProfile = async (patch: Partial<Profile>): Promise<void> => {
    if (!db || !profile) return;
    const next = { ...profile, ...patch };
    await saveProfile(db, next);
    setProfile(next);
  };

  /** FR-6.3 CSV export. Nothing leaves the device unless the user picks a target. */
  const onExport = async (): Promise<void> => {
    if (!db) return;
    try {
      const csv = await exportCsv(db);
      if (csv.split('\n').length <= 2) {
        Alert.alert('Nothing to export yet', 'Log a few check-ins first.');
        return;
      }
      await Share.share({ message: csv, title: 'fleur-export.csv' });
    } catch (error) {
      console.error('[fleur] CSV export failed', error);
      Alert.alert('Export failed', 'Could not build the export. Please try again.');
    }
  };

  const onRequestLocation = async (): Promise<void> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(status === 'granted');
    if (status === 'granted') {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      await updateProfile({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
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

  /**
   * Development only. Editing a day overwrites it, so there is otherwise no
   * way back to a genuinely un-logged date — which is the state the check-in
   * flow needs to be exercised from.
   */
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

  /** FR-7.2: typed confirmation, then an irreversible wipe. */
  const onDelete = async (): Promise<void> => {
    if (confirmText !== CONFIRM_PHRASE) return;
    await deleteAllData();
    setShowDelete(false);
    setConfirmText('');
    await refresh();
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
        <Card style={{ marginTop: spacing.lg }}>
          <SectionRow
            icon={<PersonIcon size={19} color={palette.primary} />}
            tint={palette.primarySoft}
            title="Your psoriasis"
            subtitle="Helps put your check-ins in context"
          />
          <View style={{ marginTop: spacing.lg }}>
            <ChoiceRow
              options={PSORIASIS_TYPES}
              value={profile?.psoriasisType ?? null}
              labels={PSORIASIS_TYPE_LABELS}
              onChange={(next: PsoriasisType) => void updateProfile({ psoriasisType: next })}
            />
          </View>
          <Divider style={{ marginTop: spacing.lg }} />
          <ToggleRow
            label="On a systemic or biologic treatment"
            value={profile?.onSystemic ?? false}
            onChange={(next) => void updateProfile({ onSystemic: next })}
          />
        </Card>
      </Reveal>

      <Reveal delay={130}>
        <Card style={{ marginTop: spacing.md }}>
          <SectionRow
            icon={<ShieldIcon size={19} color={palette.aqua} />}
            tint={palette.aquaSoft}
            title="Permissions & privacy"
            subtitle="Everything you log stays on this device"
          />

          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: spacing.md }}>
              <PinIcon size={18} color={palette.textMuted} />
              <View style={{ flex: 1 }}>
                <Txt variant="label">Location</Txt>
                <Txt variant="caption" tone="faint">
                  {locationGranted
                    ? (profile?.cityLabel ?? 'Approximate location, for weather')
                    : 'Not granted — weather data unavailable'}
                </Txt>
              </View>
              {!locationGranted ? (
                <Button label="Allow" variant="quiet" onPress={() => void onRequestLocation()} />
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <PulseIcon size={18} color={palette.textMuted} />
              <View style={{ flex: 1 }}>
                <Txt variant="label">Health data</Txt>
                <Txt variant="caption" tone="faint">
                  {HEALTH_ENABLED
                    ? `Reading ${REQUESTED_SCOPES.join(', ')}`
                    : 'Off. Sleep is entered manually on the check-in form.'}
                </Txt>
              </View>
            </View>
          </View>

          <Card tone="alt" level={1} style={{ marginTop: spacing.lg }}>
            <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
              Only your rounded coordinates are ever sent anywhere, and only to a public weather
              service. There is no account, no server, and no analytics.
            </Txt>
          </Card>
        </Card>
      </Reveal>

      <Reveal delay={190}>
        <Card style={{ marginTop: spacing.md }}>
          <SectionRow
            icon={<InfoIcon size={19} color={palette.textMuted} />}
            tint={palette.surfaceAlt}
            title="Your data"
            subtitle={`${days} check-${days === 1 ? 'in' : 'ins'} · model ${model.model_version}`}
          />

          <View style={{ marginTop: spacing.lg }}>
            <ActionRow
              icon={<ExportIcon size={18} color={palette.primary} />}
              label="Export as CSV"
              hint="Share a copy of everything you have logged"
              onPress={() => void onExport()}
            />
            <ActionRow
              icon={<ShieldIcon size={18} color={palette.primary} />}
              label="View full disclaimer"
              onPress={() => setShowDisclaimer(true)}
            />
            <ActionRow
              icon={<TrashIcon size={18} color={palette.destructive} />}
              label="Delete all data"
              hint="Irreversible"
              destructive
              onPress={() => setShowDelete(true)}
            />
          </View>
        </Card>
      </Reveal>

      {/* Development only — `DEV_TOOLS_ENABLED` is `__DEV__`, so this whole
          block is absent from a release build. It exists because FR-4.2 hides
          the forecast until 14 days are logged while FR-2.4 caps back-fill at
          7, leaving the risk screens unreachable by hand on a fresh install. */}
      {DEV_TOOLS_ENABLED ? (
        <Reveal delay={240}>
          <Card style={{ marginTop: spacing.md, borderStyle: 'dashed', borderWidth: 1.5 }}>
            <SectionRow
              icon={<SparkIcon size={19} color={palette.aqua} />}
              tint={palette.aquaSoft}
              title="Developer tools"
              subtitle="Not present in a release build"
            />
            <View style={{ marginTop: spacing.lg }}>
              <ActionRow
                icon={<SparkIcon size={18} color={palette.primary} />}
                label={seeding ? 'Seeding…' : `Seed ${DEFAULT_SEED_DAYS} days of demo data`}
                hint="Enough history to unlock the forecast"
                onPress={() => void onSeed()}
              />
              <ActionRow
                icon={<TrashIcon size={18} color={palette.primary} />}
                label={clearing ? 'Clearing…' : "Clear today's check-in"}
                hint="Back to un-logged, so you can check in again"
                onPress={() => void onClearToday()}
              />
            </View>
          </Card>
        </Reveal>
      ) : null}

      <Txt variant="caption" tone="faint" center style={{ marginTop: spacing.xl }}>
        Fleur · experimental research prototype
      </Txt>
      <Txt variant="caption" tone="faint" center style={{ marginTop: 2 }}>
        Model trained {model.trained_at.slice(0, 10)}
      </Txt>

      <Modal visible={showDisclaimer} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(10,6,24,0.5)',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <Card level={3} style={{ padding: spacing.xl }}>
            <IconBadge background={palette.primarySoft}>
              <ShieldIcon size={20} color={palette.primary} />
            </IconBadge>
            <Txt variant="heading" style={{ marginTop: spacing.md }}>
              Before you rely on this
            </Txt>
            <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 23 }}>
              {DISCLAIMER_FULL}
            </Txt>
            <Button
              label="Close"
              variant="secondary"
              onPress={() => setShowDisclaimer(false)}
              style={{ marginTop: spacing.xl }}
            />
          </Card>
        </View>
      </Modal>

      <Modal visible={showDelete} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(10,6,24,0.5)',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <Card level={3} style={{ padding: spacing.xl }}>
            <IconBadge background={palette.destructiveSoft}>
              <TrashIcon size={20} color={palette.destructive} />
            </IconBadge>
            <Txt variant="heading" style={{ marginTop: spacing.md }}>
              Delete everything?
            </Txt>
            <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 23 }}>
              This permanently removes every check-in, all cached weather, and your profile from
              this device. It cannot be undone.
            </Txt>

            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.lg }}>
              {`Type ${CONFIRM_PHRASE} to confirm`}
            </Txt>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={CONFIRM_PHRASE}
              placeholderTextColor={palette.textFaint}
              style={{
                marginTop: spacing.sm,
                minHeight: 48,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                backgroundColor: palette.surfaceAlt,
                color: palette.text,
                fontSize: 16,
                borderWidth: 1,
                borderColor: palette.border,
              }}
            />
            <Button
              label="Delete all data"
              variant="destructive"
              onPress={() => void onDelete()}
              disabled={confirmText !== CONFIRM_PHRASE}
              style={{ marginTop: spacing.lg }}
            />
            <Button
              label="Cancel"
              variant="quiet"
              onPress={() => {
                setShowDelete(false);
                setConfirmText('');
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function SectionRow({
  icon,
  tint,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  subtitle?: string;
}): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <IconBadge background={tint} size={38}>
        {icon}
      </IconBadge>
      <View style={{ flex: 1 }}>
        <Txt variant="heading">{title}</Txt>
        {subtitle ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: 1 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onPress,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
  destructive?: boolean;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      scaleTo={0.985}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 56,
        paddingVertical: spacing.sm,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Txt
          variant="label"
          style={destructive ? { color: palette.destructive } : undefined}
        >
          {label}
        </Txt>
        {hint ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: 1 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <ChevronRight size={17} color={palette.textFaint} />
    </PressableScale>
  );
}
