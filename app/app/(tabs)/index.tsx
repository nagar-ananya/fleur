/**
 * Today (REQUIREMENTS §11.2) — v2 redesign.
 *
 * States: Collecting, Sparse, Ready, Logged. Scoring is synchronous, so the
 * risk value is present on first paint — no spinner, no network (FR-4.1).
 *
 * The dial is the screen. Everything else is arranged around it in decreasing
 * order of what a person opening the app actually wants: how am I, what do I
 * do next, how have I been, what is it like outside.
 *
 * SPEC-DEVIATION from the source design: the design's Today screen shows a
 * per-day "chance it starts that day" for the next three days. The model
 * only ever produces one 72-hour aggregate probability (§8.1) — there is no
 * real per-day sub-score to show — so that row is left out rather than
 * invented. What *is* real and shown instead: today's probability against
 * the mean of your own past predictions ("usual"), computed from the
 * `prediction` log (§6.5) rather than a fixed number.
 */

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
import {
  exportCsv,
  getEnvironmentDay,
  getLastEnvironmentFetch,
  getRecentPredictions,
  listCheckIns,
} from '../../src/db/queries';
import {
  RISK_HORIZON_KICKER,
  scoreReading,
  usualComparisonReading,
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
  const [trend, setTrend] = useState<{ date: string; value: number | null }[]>([]);
  const [ribbon, setRibbon] = useState<{ date: string; logged: boolean }[]>([]);
  const [conditions, setConditions] = useState<EnvironmentDay | null>(null);
  const [usual, setUsual] = useState<number | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
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
    void getLastEnvironmentFetch(db).then(setLastFetch);
    // "Usual": the mean of your own past predictions, so the comparison on
    // the ready card is drawn from real history, not a fixed reference.
    void getRecentPredictions(db, 60).then((rows) => {
      const past = rows.filter((r) => r.forDate !== today);
      // Stored as a fraction in the existing column; the UI works in points.
      setUsual(
        past.length ? (past.reduce((t, r) => t + r.probability, 0) / past.length) * 100 : null,
      );
    });
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

  // FR-3.1: refresh on open when the cache is stale. Failures are silent here
  // and surface only as the non-blocking indicator below (FR-3.3).
  useEffect(() => {
    void doEnvironmentRefresh(false);
    // Only on mount / when the profile's coordinates first arrive.
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
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Kicker style={{ letterSpacing: 2.4 }}>FLEUR</Kicker>
            <Txt tone="faint" variant="caption" style={{ marginTop: 6 }}>
              {`${formatLong(today)} · day ${checkinDays}`}
            </Txt>
          </View>
          <PressableScale
            onPress={() => void onExport()}
            accessibilityLabel="Export your data as CSV"
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <ExportIcon size={17} color={palette.textMuted} />
          </PressableScale>
        </View>
        <Txt variant="display" style={{ marginTop: spacing.md }}>
          {greeting()}
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <View style={{ marginTop: spacing.xl }}>
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
              driverCount={risk.drivers.length}
              usual={usual}
              band={risk.band}
              onOpen={() => router.push('/risk-detail')}
            />
          ) : null}
        </View>
      </Reveal>

      {/* FR-3.3: non-blocking indicator, never a modal or an error state. */}
      {environmentStatus === 'unavailable' ? (
        <Reveal delay={100}>
          <Card tone="alt" style={{ marginTop: spacing.md }} level={1}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <CloudOffIcon size={17} color={palette.textFaint} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" tone="muted">
                  {`Environment data unavailable${lastFetch ? ` · cached ${formatRelativeTime(lastFetch)}` : ''}. Your risk still computes on-device.`}
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

      {trend.some((p) => p.value !== null) ? (
        <Reveal delay={200}>
          <Card style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt variant="heading">Last 7 days</Txt>
              <IconBadge background={palette.aquaSoft} size={32}>
                <TrendUpIcon size={17} color={palette.aqua} />
              </IconBadge>
            </View>
            <TrendChart points={trend} height={104} interactive />
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

      {/* §17: additive only. The number above is always the local one. */}
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

      {risk.status === 'ready' ? (
        <Reveal delay={310}>
          <PressableScale onPress={() => router.push('/reset')} accessibilityLabel="Open Reset" scaleTo={0.99}>
            <Card style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconBadge background={palette.primarySoft}>
                <LeafIcon size={18} color={palette.primary} />
              </IconBadge>
              <Txt variant="label" style={{ flex: 1 }}>
                Reset — 3 things for today
              </Txt>
              <ChevronRight size={17} color={palette.textFaint} />
            </Card>
          </PressableScale>
        </Reveal>
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
  score,
  driverCount,
  usual,
  band,
  onOpen,
}: {
  score: number;
  driverCount: number;
  usual: number | null;
  band: 'low' | 'elevated' | 'high';
  onOpen: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const style = bandStyle(band, palette);
  const points = useCountUp(score);
  const comparison = usualComparisonReading(score, usual);

  return (
    <PressableScale
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityLabel={`Flare risk ${style.label}, ${score} points out of 100`}
      accessibilityHint="Opens the full breakdown"
    >
      <Card level={2} style={{ paddingTop: spacing.xl }}>
        <Kicker>{RISK_HORIZON_KICKER}</Kicker>

        {/* Points, not a percentage — the number is a tally, and writing it
            with a % sign would invite reading it as a probability. */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' }}>
          <Txt variant="hero" style={{ color: style.text }}>
            {points}
          </Txt>
          <Txt tone="faint" style={{ paddingBottom: 6 }}>/ 100</Txt>
          <Pill label={style.label} color={style.text} background={style.soft} />
        </View>

        <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 22, maxWidth: 320 }}>
          {scoreReading(score, driverCount)}
        </Txt>

        {usual !== null ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <UsualBar label="TODAY" value={score} fill={style.fill} accent />
            <UsualBar label="USUAL" value={usual} fill={palette.textFaint} />
          </View>
        ) : null}

        {comparison ? (
          <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 21 }}>
            {comparison}
          </Txt>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: spacing.lg,
            paddingTop: spacing.lg,
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
            Unavailable right now. Your score above is unaffected — it is worked
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
          ? `Fleur's own rules agree — both read ${bandStyle(localBand, palette).label.toLowerCase()}.`
          : `Fleur's own rules read ${bandStyle(localBand, palette).label.toLowerCase()}, ${
              drift > 0 ? 'lower' : 'higher'
            } than the AI. When they disagree, the rules are the number Fleur stands behind — they can be checked by hand.`}
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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: palette.primary,
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.primary }} />
      <Txt variant="micro" tone="accent">
        {label}
      </Txt>
    </View>
  );
}

function UsualBar({
  label,
  value,
  fill,
  accent = false,
}: {
  label: string;
  value: number;
  fill: string;
  accent?: boolean;
}): React.ReactElement {
  const { palette } = useTheme();
  const points = Math.min(100, Math.round(value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Txt variant="micro" tone={accent ? 'accent' : 'faint'} style={{ width: 46 }}>
        {label}
      </Txt>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${points}%`, borderRadius: 3, backgroundColor: fill }} />
      </View>
      <Txt variant="label" style={{ width: 36, textAlign: 'right' }}>
        {points}
      </Txt>
    </View>
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

      {/* Flat count — no ring. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md }}>
        <Txt variant="hero" tone="accent">
          {days}
        </Txt>
        <Txt variant="heading" tone="faint">
          {`of ${required} days`}
        </Txt>
      </View>

      <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 22, maxWidth: 320 }}>
        Fleur needs {required} distinct days before it shows a risk number. Lagged features
        cannot be computed from a shorter window, and a forecast built on less would be noise
        dressed up as insight.
      </Txt>

      <NoRiskYetPill label="NO RISK VALUE SHOWN YET" />

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
        Already working: your check-ins, cached weather, and the trigger reference.
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
      <Kicker>Forecasting paused</Kicker>
      <Txt variant="heading" style={{ marginTop: spacing.sm }}>
        Log a few more days to resume forecasting
      </Txt>
      <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
        Above 40% of the last two weeks missing, too many rules have nothing to look at —
        Fleur would be scoring from gaps, not from you.
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
      <Card style={{ marginTop: spacing.md, borderColor: palette.primary, borderWidth: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBadge background={palette.primarySoft}>
            <PlusIcon size={20} color={palette.primary} />
          </IconBadge>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">Log today's check-in</Txt>
            <Txt variant="caption" tone="faint" style={{ marginTop: 1 }}>
              5 quick steps · most of it filled in for you
            </Txt>
          </View>
          <ChevronRight size={18} color={palette.primary} />
        </View>
      </Card>
    </PressableScale>
  );
}

/**
 * Today's conditions, straight from the cached Open-Meteo rows.
 *
 * SPEC-DEVIATION: §11.2's "Contains" list does not mention this. It earns its
 * place — these are the exact environmental inputs the weather rules read, so
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
        Conditions where you are — the same readings your score uses
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

