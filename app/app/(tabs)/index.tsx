import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { TrendChart, DayRibbon } from '../../src/components/charts';
import {
  ChevronRight,
  CloudOffIcon,
  DropletIcon,
  ExportIcon,
  HazeIcon,
  LeafIcon,
  PlusIcon,
  SunIcon,
  ThermometerIcon,
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
import {
  exportCsv,
  getEnvironmentDay,
  getLastEnvironmentFetch,
  listCheckIns,
} from '../../src/db/queries';
import {
  RISK_HORIZON_KICKER,
} from '../../src/constants/copy';
import { useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { bandStyle, radius, spacing, type Palette } from '../../src/theme';
import type { EnvironmentDay, StoredAiOpinion } from '../../src/types/models';
import { addDays, dateRange, formatLong, todayLocal } from '../../src/utils/dates';
import { formatRelativeTime } from '../../src/utils/relativeTime';

export default function TodayScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const {
    risk,
    refresh,
    refreshEnvironment,
    environmentStatus,
    todayLogged,
    profile,
    db,
    checkinDays,
    analysisMode,
    aiOpinion,
    aiStatus,
    refreshAiOpinion,
  } = useApp();
  const [ribbon, setRibbon] = useState<{ date: string; logged: boolean }[]>([]);
  const [conditions, setConditions] = useState<EnvironmentDay | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const today = todayLocal();
  const trend =
    risk.status === 'ready'
      ? risk.history.slice(-7).map((day) => ({ date: day.date, value: day.score }))
      : [];

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!db) return;
    const from = addDays(today, -13);
    void listCheckIns(db, from, today).then((rows) => {
      const logged = new Set(rows.map((r) => r.date));
      const window = dateRange(from, today);
      setRibbon(window.map((date) => ({ date, logged: logged.has(date) })));
    });
    void getEnvironmentDay(db, today).then(setConditions);
    void getLastEnvironmentFetch(db).then(setLastFetch);
  }, [db, today, risk]);

  const doEnvironmentRefresh = useCallback(
    async (force = false) => {
      if (profile?.latitude != null && profile.longitude != null) {
        await refreshEnvironment({ latitude: profile.latitude, longitude: profile.longitude }, force);
        return;
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const position = await Location.getLastKnownPositionAsync();
        if (position) {
          await refreshEnvironment(
            { latitude: position.coords.latitude, longitude: position.coords.longitude },
            force,
          );
        }
      } catch (error) {
        console.warn('[fleur] location unavailable', error);
      }
    },
    [profile, refreshEnvironment],
  );

  useEffect(() => {
    void doEnvironmentRefresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.latitude, profile?.longitude]);

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
    }
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt variant="title" tone="accent">
            Fleur
          </Txt>
          <PressableScale
            onPress={() => void onExport()}
            accessibilityLabel="Export your data as CSV"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.surface,
            }}
          >
            <ExportIcon size={18} color={palette.textMuted} />
          </PressableScale>
        </View>
        <Txt variant="display" style={{ marginTop: spacing.md }}>
          {greeting()}
        </Txt>
        <Txt tone="muted" style={{ marginTop: 2 }}>
          {`${formatLong(today)} - day ${checkinDays}`}
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <View style={{ marginTop: spacing.lg }}>
          {risk.status === 'loading' ? <LoadingCard /> : null}
          {risk.status === 'collecting' ? (
            <CollectingCard
              days={risk.days}
              required={risk.required}
              ribbon={ribbon}
              onCheckIn={() => router.push('/checkin')}
              onBackfill={() => router.push('/backfill')}
            />
          ) : null}
          {risk.status === 'sparse' ? (
            <SparseCard ribbon={ribbon} onBackfill={() => router.push('/backfill')} />
          ) : null}
          {risk.status === 'ready' ? (
            <ReadyCard
              score={risk.score}
              band={risk.band}
              onOpen={() => router.push('/risk-detail')}
            />
          ) : null}
        </View>
      </Reveal>

      {environmentStatus === 'unavailable' ? (
        <Reveal delay={100}>
          <Card tone="alt" style={{ marginTop: spacing.md }} level={1}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <CloudOffIcon size={17} color={palette.textFaint} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" tone="muted">
                  {`Couldn't get the weather right now${lastFetch ? ` (last updated ${formatRelativeTime(lastFetch)})` : ''}. Your score still works without it.`}
                </Txt>
              </View>
              <PressableScale onPress={() => void doEnvironmentRefresh(true)} accessibilityLabel="Retry">
                <Txt variant="caption" tone="accent">
                  Retry
                </Txt>
              </PressableScale>
            </View>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={140}>
        <CheckInCard
          logged={todayLogged}
          onPress={() => router.push('/checkin')}
          palette={palette}
        />
      </Reveal>

      {trend.length > 1 ? (
        <Reveal delay={200}>
          <Card style={{ marginTop: spacing.md }}>
            <Txt variant="heading">Last 7 days</Txt>
            <Txt variant="caption" tone="faint" style={{ marginTop: 2, marginBottom: spacing.sm }}>
              Your flare score each day
            </Txt>
            <TrendChart
              points={trend}
              height={150}
              max={100}
              interactive
              describe={(v) => `${v} points`}
            />
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

      {analysisMode === 'local_plus_ai' && risk.status === 'ready' ? (
        <Reveal delay={290}>
          <AiCard
            status={aiStatus}
            opinion={aiOpinion}
            localBand={risk.band}
            localScore={risk.score}
            onRetry={() => void refreshAiOpinion(true)}
          />
        </Reveal>
      ) : null}

      <ShortDisclaimer />
    </Screen>
  );
}

function LoadingCard(): React.ReactElement {
  return (
    <Card style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center' }}>
      <Txt tone="faint">Loading…</Txt>
    </Card>
  );
}

function ReadyCard({
  score,
  band,
  onOpen,
}: {
  score: number;
  band: 'low' | 'elevated' | 'high';
  onOpen: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const style = bandStyle(band, palette);
  const points = useCountUp(score);

  return (
    <PressableScale
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityLabel={`Flare risk ${style.label}, ${score} points out of 100`}
      accessibilityHint="Opens the full breakdown"
    >
      <Card level={2}>
        <Kicker>{RISK_HORIZON_KICKER}</Kicker>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Txt variant="hero" style={{ color: style.text, fontSize: 72, lineHeight: 84 }}>
            {points}
          </Txt>
          <Txt variant="heading" tone="faint" style={{ marginTop: spacing.md }}>
            / 100
          </Txt>
          <View style={{ flex: 1 }} />
          <Pill label={style.label} color={style.text} background={style.soft} style={{ alignSelf: 'center' }} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: spacing.sm,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: palette.border,
          }}
        >
          <Txt variant="label" tone="accent" style={{ flex: 1 }}>
            See how the points add up
          </Txt>
          <ChevronRight size={16} color={palette.primary} />
        </View>
      </Card>
    </PressableScale>
  );
}

function AiCard({
  status,
  opinion,
  localBand,
  localScore,
  onRetry,
}: {
  status: 'off' | 'loading' | 'ok' | 'unavailable';
  opinion: StoredAiOpinion | null;
  localBand: 'low' | 'elevated' | 'high';
  localScore: number;
  onRetry: () => void;
}): React.ReactElement | null {
  const { palette } = useTheme();
  if (status === 'off') return null;

  if (status === 'loading') {
    return (
      <Card tone="alt" level={1} style={{ marginTop: spacing.md }}>
        <Kicker>AI second opinion</Kicker>
        <Txt tone="faint" style={{ marginTop: spacing.sm }}>
          Asking…
        </Txt>
      </Card>
    );
  }

  if (status === 'unavailable' || !opinion) {
    return (
      <PressableScale onPress={onRetry} accessibilityLabel="Retry the AI second opinion" scaleTo={0.99}>
        <Card tone="alt" level={1} style={{ marginTop: spacing.md }}>
          <Kicker>AI second opinion</Kicker>
          <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 21 }}>
            Not available right now. Your score above still works because it is worked
            out on this phone. Tap to try again.
          </Txt>
        </Card>
      </PressableScale>
    );
  }

  const style = bandStyle(opinion.band, palette);
  const agrees = opinion.band === localBand;
  const drift = opinion.score - localScore;

  return (
    <Card tone="alt" level={1} style={{ marginTop: spacing.md }}>
      <Kicker>AI second opinion</Kicker>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: spacing.sm,
          marginTop: spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        <Txt variant="title" style={{ color: style.text }}>
          {opinion.score}
        </Txt>
        <Txt tone="faint">/ 100</Txt>
        <Pill label={style.label} color={style.text} background={style.soft} />
      </View>

      <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 21 }}>
        {agrees
          ? `Fleur's rules agree. Both say ${bandStyle(localBand, palette).label.toLowerCase()}.`
          : `Fleur's rules say ${bandStyle(localBand, palette).label.toLowerCase()}, which is ${
              drift > 0 ? 'lower' : 'higher'
            } than the AI. If they don't match, go with Fleur's rules, since you can check them by hand.`}
      </Txt>

      {opinion.summary ? (
        <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 21, fontStyle: 'italic' }}>
          {opinion.summary}
        </Txt>
      ) : null}
    </Card>
  );
}

function NoRiskYetPill({ label }: { label: string }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <Pill label={label} color={palette.primary} background={palette.primarySoft} style={{ marginTop: spacing.md }} />
  );
}

function CollectingCard({
  days,
  required,
  ribbon,
  onCheckIn,
  onBackfill,
}: {
  days: number;
  required: number;
  ribbon: readonly { date: string; logged: boolean }[];
  onCheckIn: () => void;
  onBackfill: () => void;
}): React.ReactElement {
  return (
    <Card level={2} style={{ paddingTop: spacing.xl }}>
      <Kicker>Collecting data</Kicker>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md }}>
        <Txt variant="hero" tone="accent" style={{ fontSize: 64, lineHeight: 76 }}>
          {days}
        </Txt>
        <Txt variant="heading" tone="faint">
          {`of ${required} days`}
        </Txt>
      </View>

      <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 22, maxWidth: 320 }}>
        Fleur needs {required} days of check-ins before it can show a score. Some rules look back
        up to two weeks, so it needs that much data first.
      </Txt>

      <NoRiskYetPill label="No score yet" />

      {ribbon.length > 0 ? (
        <View style={{ width: '100%', marginTop: spacing.lg }}>
          <DayRibbon days={ribbon} height={30} />
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
            Your last {ribbon.length} days
          </Txt>
        </View>
      ) : null}

      <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
        <Button label={`Log day ${days + 1}`} onPress={onCheckIn} />
        <Button label="Backfill a missed day" variant="secondary" onPress={onBackfill} />
      </View>

      <Txt variant="caption" tone="faint" center style={{ marginTop: spacing.md }}>
        Your check-ins are saved as you go.
      </Txt>
    </Card>
  );
}

function SparseCard({
  ribbon,
  onBackfill,
}: {
  ribbon: readonly { date: string; logged: boolean }[];
  onBackfill: () => void;
}): React.ReactElement {
  return (
    <Card level={2}>
      <Kicker>Not enough recent data</Kicker>
      <Txt variant="heading" style={{ marginTop: spacing.sm }}>
        Log a few more days to get your score back
      </Txt>
      <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
        More than 40% of the last two weeks is missing, so there isn't enough data for a score
        right now.
      </Txt>
      {ribbon.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <DayRibbon days={ribbon} height={30} />
        </View>
      ) : null}
      <Button
        label="Backfill the last 7 days"
        variant="secondary"
        onPress={onBackfill}
        style={{ marginTop: spacing.lg }}
      />
    </Card>
  );
}

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
              <Txt variant="label">Today's check-in logged</Txt>
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
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityLabel="Log today's check-in">
      <View style={{ marginTop: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            borderRadius: radius.xl,
            backgroundColor: palette.primary,
            padding: spacing.lg,
          }}
        >
          <IconBadge background="rgba(255,255,255,0.18)">
            <PlusIcon size={20} color={palette.onAccent} />
          </IconBadge>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" tone="onAccent">
              Log today's check-in
            </Txt>
            <Txt variant="caption" style={{ marginTop: 1, color: 'rgba(255,255,255,0.86)' }}>
              9 quick questions, about 30 seconds
            </Txt>
          </View>
          <ChevronRight size={18} color={palette.onAccent} />
        </View>
      </View>
    </PressableScale>
  );
}

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
      icon: <ThermometerIcon size={20} color={palette.primary} />,
      value: `${Math.round((conditions.tempMeanC * 9) / 5 + 32)}°F`,
      label: 'Temp',
    });
  }
  if (conditions.humidityMeanPct !== null) {
    items.push({
      key: 'humidity',
      icon: <DropletIcon size={20} color={palette.tints.sky.ink} />,
      value: `${Math.round(conditions.humidityMeanPct)}%`,
      label: 'Humidity',
    });
  }
  if (conditions.uvIndexMax !== null) {
    items.push({
      key: 'uv',
      icon: <SunIcon size={20} color={palette.tints.butter.ink} />,
      value: conditions.uvIndexMax.toFixed(1),
      label: 'UV',
    });
  }
  if (conditions.pm25 !== null) {
    items.push({
      key: 'pm',
      icon: <HazeIcon size={20} color={palette.textMuted} />,
      value: Math.round(conditions.pm25).toString(),
      label: 'PM2.5',
    });
  }
  if (conditions.pollenTotal !== null) {
    items.push({
      key: 'pollen',
      icon: <LeafIcon size={20} color={palette.tints.sage.ink} />,
      value: Math.round(conditions.pollenTotal).toString(),
      label: 'Pollen',
    });
  }

  if (items.length === 0) return <View />;

  return (
    <Card style={{ marginTop: spacing.md }} tone="alt" level={1}>
      <Txt variant="caption" tone="faint" style={{ marginBottom: spacing.md }}>
        Weather where you are (used in your score)
      </Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {items.map((item) => (
          <View key={item.key} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            {item.icon}
            <Txt variant="heading" style={{ fontSize: 17 }}>
              {item.value}
            </Txt>
            <Txt variant="caption" tone="faint" style={{ fontSize: 12 }}>
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

