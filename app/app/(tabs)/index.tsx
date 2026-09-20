/**
 * Today (REQUIREMENTS §11.2).
 *
 * States: Collecting, Sparse, Ready, Logged. Scoring is synchronous, so the
 * risk value is present on first paint — no spinner, no network (FR-4.1).
 *
 * The dial is the screen. Everything else is arranged around it in decreasing
 * order of what a person opening the app actually wants: how am I, what do I
 * do next, how have I been, what is it like outside.
 */

import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ProgressDial, RiskDial, TrendChart, DayRibbon } from '../../src/components/charts';
import {
  ChevronRight,
  DropletIcon,
  HazeIcon,
  LeafIcon,
  PlusIcon,
  SunIcon,
  ThermometerIcon,
  TrendUpIcon,
  CheckIcon,
} from '../../src/components/icons';
import { PressableScale, Reveal, useCountUp } from '../../src/components/motion';
import {
  Button,
  Card,
  IconBadge,
  Kicker,
  Pill,
  Screen,
  ShortDisclaimer,
  Txt,
} from '../../src/components/primitives';
import { getEnvironmentDay, listCheckIns } from '../../src/db/queries';
import { model, useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { bandStyle, radius, spacing, type Palette } from '../../src/theme';
import type { EnvironmentDay } from '../../src/types/models';
import { addDays, dateRange, formatLong, todayLocal } from '../../src/utils/dates';

export default function TodayScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { risk, refresh, refreshEnvironment, environmentStatus, todayLogged, profile, db } =
    useApp();
  const [trend, setTrend] = useState<{ date: string; value: number | null }[]>([]);
  const [ribbon, setRibbon] = useState<{ date: string; logged: boolean }[]>([]);
  const [conditions, setConditions] = useState<EnvironmentDay | null>(null);
  const today = todayLocal();

  // Recompute whenever the screen regains focus — returning from a check-in
  // must show the updated number (FR-4.3).
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!db) return;
    const from = addDays(today, -13);
    void listCheckIns(db, from, today).then((rows) => {
      const byDate = new Map(rows.map((r) => [r.date, r.severity]));
      const window = dateRange(from, today);
      setTrend(
        window.slice(-7).map((date) => ({ date, value: byDate.get(date) ?? null })),
      );
      setRibbon(window.map((date) => ({ date, logged: byDate.has(date) })));
    });
    void getEnvironmentDay(db, today).then(setConditions);
  }, [db, today, risk]);

  // FR-3.1: refresh on open when the cache is stale. Failures are silent here
  // and surface only as the non-blocking indicator below (FR-3.3).
  useEffect(() => {
    void (async () => {
      if (profile?.latitude != null && profile.longitude != null) {
        await refreshEnvironment({ latitude: profile.latitude, longitude: profile.longitude });
        return;
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const position = await Location.getLastKnownPositionAsync();
        if (position) {
          await refreshEnvironment({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } catch (error) {
        console.warn('[fleur] location unavailable', error);
      }
    })();
  }, [profile, refreshEnvironment]);

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>{formatLong(today)}</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          {greeting()}
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <View style={{ marginTop: spacing.xl }}>
          {risk.status === 'loading' ? <LoadingCard /> : null}
          {risk.status === 'collecting' ? (
            <CollectingCard days={risk.days} required={risk.required} ribbon={ribbon} />
          ) : null}
          {risk.status === 'sparse' ? <SparseCard ribbon={ribbon} /> : null}
          {risk.status === 'ready' ? (
            <ReadyCard
              probability={risk.probability}
              band={risk.band}
              drivers={risk.drivers}
              onOpen={() => router.push('/risk-detail')}
            />
          ) : null}
        </View>
      </Reveal>

      <Reveal delay={140}>
        <CheckInCard
          logged={todayLogged}
          onPress={() => router.push('/checkin')}
          palette={palette}
        />
      </Reveal>

      {trend.some((p) => p.value !== null) ? (
        <Reveal delay={200}>
          <Card style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt variant="heading">Last 7 days</Txt>
              <IconBadge background={palette.aquaSoft} size={32}>
                <TrendUpIcon size={17} color={palette.aqua} />
              </IconBadge>
            </View>
            <TrendChart points={trend} height={104} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="caption" tone="faint">
                7 days ago
              </Txt>
              <Txt variant="caption" tone="faint">
                Today
              </Txt>
            </View>
          </Card>
        </Reveal>
      ) : null}

      {conditions ? (
        <Reveal delay={260}>
          <ConditionsStrip conditions={conditions} palette={palette} />
        </Reveal>
      ) : null}

      {/* FR-3.3: non-blocking indicator, never a modal or an error state. */}
      {environmentStatus === 'unavailable' ? (
        <Card tone="alt" style={{ marginTop: spacing.md }} level={1}>
          <Txt variant="caption" tone="muted">
            Weather data is unavailable right now. Everything else still works, and your risk is
            computed from what is already saved.
          </Txt>
        </Card>
      ) : null}

      <ShortDisclaimer />
    </Screen>
  );
}

// --------------------------------------------------------------------------
// Hero states
// --------------------------------------------------------------------------

function LoadingCard(): React.ReactElement {
  return (
    <Card style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center' }}>
      <Txt tone="faint">Reading your recent days…</Txt>
    </Card>
  );
}

function ReadyCard({
  probability,
  band,
  drivers,
  onOpen,
}: {
  probability: number;
  band: 'low' | 'elevated' | 'high';
  drivers: readonly { name: string; label: string }[];
  onOpen: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const style = bandStyle(band, palette);
  const percent = useCountUp(probability * 100);

  return (
    <PressableScale
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityLabel={`Flare risk ${style.label}, ${Math.round(probability * 100)} percent`}
      accessibilityHint="Opens the full breakdown"
    >
      <Card level={2} style={{ alignItems: 'center', paddingTop: spacing.xl }}>
        <Kicker>Next 72 hours</Kicker>

        <RiskDial probability={probability} band={band} threshold={model.threshold} size={252}>
          <Txt variant="hero" style={{ color: style.text }}>
            {`${percent}%`}
          </Txt>
          <Pill
            label={style.label}
            color={style.text}
            background={style.soft}
            // `Pill` defaults to flex-start so it hugs content in a row; inside
            // the dial it has to sit under the number, not against the arc.
            style={{ marginTop: 2, alignSelf: 'center' }}
          />
        </RiskDial>

        <Txt tone="muted" center style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          {style.blurb}
        </Txt>

        {drivers.length > 0 ? (
          <View style={{ width: '100%', marginTop: spacing.lg }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.sm,
                justifyContent: 'center',
              }}
            >
              {drivers.map((driver) => (
                <View
                  key={driver.name}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: palette.surfaceAlt,
                    borderRadius: radius.pill,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 7,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: style.fill,
                    }}
                  />
                  <Txt variant="caption">{driver.label}</Txt>
                </View>
              ))}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                marginTop: spacing.lg,
              }}
            >
              <Txt variant="label" tone="accent">
                See what's driving this
              </Txt>
              <ChevronRight size={16} color={palette.primary} />
            </View>
          </View>
        ) : null}
      </Card>
    </PressableScale>
  );
}

function CollectingCard({
  days,
  required,
  ribbon,
}: {
  days: number;
  required: number;
  ribbon: readonly { date: string; logged: boolean }[];
}): React.ReactElement {
  const { palette } = useTheme();
  const remaining = Math.max(required - days, 0);

  return (
    <Card level={2} style={{ alignItems: 'center', paddingTop: spacing.xl }}>
      <Kicker>Building your baseline</Kicker>

      <ProgressDial current={days} total={required} size={252}>
        <Txt variant="hero" tone="accent">
          {days}
        </Txt>
        <Txt variant="caption" tone="faint">
          {`of ${required} days`}
        </Txt>
      </ProgressDial>

      <Txt variant="heading" center style={{ marginTop: spacing.sm }}>
        {remaining === 0 ? 'Almost there' : `${remaining} more ${remaining === 1 ? 'day' : 'days'}`}
      </Txt>
      <Txt tone="muted" center style={{ marginTop: spacing.sm, lineHeight: 22 }}>
        Fleur compares today with your own usual pattern, so it needs {required} days of
        check-ins before a forecast means anything.
      </Txt>

      {ribbon.length > 0 ? (
        <View style={{ width: '100%', marginTop: spacing.lg }}>
          <DayRibbon days={ribbon} height={30} />
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
            Your last {ribbon.length} days
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

function SparseCard({
  ribbon,
}: {
  ribbon: readonly { date: string; logged: boolean }[];
}): React.ReactElement {
  return (
    <Card level={2}>
      <Txt variant="heading">A few more days will bring this back</Txt>
      <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
        There are too many gaps in the last two weeks for a fair comparison, so Fleur is holding
        off rather than showing you a number it does not trust.
      </Txt>
      {ribbon.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <DayRibbon days={ribbon} height={30} />
        </View>
      ) : null}
    </Card>
  );
}

// --------------------------------------------------------------------------
// Secondary cards
// --------------------------------------------------------------------------

function CheckInCard({
  logged,
  onPress,
  palette,
}: {
  logged: boolean;
  onPress: () => void;
  palette: Palette;
}): React.ReactElement {
  if (logged) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel="Edit today's check-in">
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge background={palette.bandLowSoft}>
              <CheckIcon size={20} color={palette.bandLowText} />
            </IconBadge>
            <View style={{ flex: 1 }}>
              <Txt variant="label">Today is logged</Txt>
              <Txt variant="caption" tone="faint" style={{ marginTop: 1 }}>
                Tap to change anything
              </Txt>
            </View>
            <ChevronRight size={18} color={palette.textFaint} />
          </View>
        </Card>
      </PressableScale>
    );
  }

  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconBadge background={palette.primarySoft}>
          <PlusIcon size={20} color={palette.primary} />
        </IconBadge>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">How is your skin today?</Txt>
          <Txt variant="caption" tone="faint" style={{ marginTop: 1 }}>
            About 30 seconds
          </Txt>
        </View>
      </View>
      <Button label="Start check-in" onPress={onPress} style={{ marginTop: spacing.lg }} />
    </Card>
  );
}

/**
 * Today's conditions, straight from the cached Open-Meteo rows.
 *
 * SPEC-DEVIATION: §11.2's "Contains" list does not mention this. It earns its
 * place — these are the exact environmental inputs the model consumes, so
 * showing them makes the forecast legible instead of opaque, and justifies the
 * location permission the app asked for. Kept visually secondary.
 */
function ConditionsStrip({
  conditions,
  palette,
}: {
  conditions: EnvironmentDay;
  palette: Palette;
}): React.ReactElement {
  const items: { key: string; icon: React.ReactNode; value: string; label: string }[] = [];

  if (conditions.tempMeanC !== null) {
    items.push({
      key: 'temp',
      icon: <ThermometerIcon size={18} color={palette.primary} />,
      value: `${Math.round(conditions.tempMeanC)}°`,
      label: 'Temp',
    });
  }
  if (conditions.humidityMeanPct !== null) {
    items.push({
      key: 'humidity',
      icon: <DropletIcon size={18} color={palette.aqua} />,
      value: `${Math.round(conditions.humidityMeanPct)}%`,
      label: 'Humidity',
    });
  }
  if (conditions.uvIndexMax !== null) {
    items.push({
      key: 'uv',
      icon: <SunIcon size={18} color={palette.bandElevatedFill} />,
      value: conditions.uvIndexMax.toFixed(1),
      label: 'UV',
    });
  }
  if (conditions.pm25 !== null) {
    items.push({
      key: 'pm',
      icon: <HazeIcon size={18} color={palette.textMuted} />,
      value: Math.round(conditions.pm25).toString(),
      label: 'PM2.5',
    });
  }
  if (conditions.pollenTotal !== null) {
    items.push({
      key: 'pollen',
      icon: <LeafIcon size={18} color={palette.bandLowFill} />,
      value: Math.round(conditions.pollenTotal).toString(),
      label: 'Pollen',
    });
  }

  if (items.length === 0) return <View />;

  return (
    <Card style={{ marginTop: spacing.md }} tone="alt" level={1}>
      <Txt variant="caption" tone="faint" style={{ marginBottom: spacing.md }}>
        Conditions where you are — the same readings the model uses
      </Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {items.map((item) => (
          <View key={item.key} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            {item.icon}
            <Txt variant="label">{item.value}</Txt>
            <Txt variant="caption" tone="faint" style={{ fontSize: 11 }}>
              {item.label}
            </Txt>
          </View>
        ))}
      </View>
    </Card>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
