/**
 * History (REQUIREMENTS §11, FR-6.x).
 *
 * A 90-day severity grid aligned to real weekdays, a trend line, and a day
 * sheet that offers an edit when the date is still inside the 7-day back-fill
 * window (FR-6.2).
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { ActivityGrid, HeatLegend, TrendChart } from '../../src/components/charts';
import { PulseIcon } from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import {
  Button,
  Card,
  Divider,
  IconBadge,
  Kicker,
  Screen,
  StatTile,
  Txt,
} from '../../src/components/primitives';
import { listCheckIns } from '../../src/db/queries';
import { detectEpisodes } from '../../src/utils/episodes';
import { useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { radius, spacing, severityWord } from '../../src/theme';
import type { CheckIn } from '../../src/types/models';
import {
  addDays,
  dateRange,
  formatLong,
  formatShort,
  isEditableDate,
  todayLocal,
} from '../../src/utils/dates';

const WINDOW_DAYS = 90; // FR-6.1

export default function HistoryScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db } = useApp();
  const [checkIns, setCheckIns] = useState<Map<string, CheckIn>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);

  const today = todayLocal();
  const from = addDays(today, -(WINDOW_DAYS - 1));

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      void listCheckIns(db, from, today).then((rows) => {
        setCheckIns(new Map(rows.map((row) => [row.date, row])));
      });
    }, [db, from, today]),
  );

  const days = useMemo(
    () =>
      dateRange(from, today).map((date) => ({
        date,
        severity: checkIns.get(date)?.severity ?? null,
      })),
    [from, today, checkIns],
  );

  const logged = days.filter((d) => d.severity !== null);
  const average =
    logged.length > 0
      ? logged.reduce((total, d) => total + (d.severity ?? 0), 0) / logged.length
      : null;

  const selectedCheckIn = selected ? (checkIns.get(selected) ?? null) : null;
  const episodes = useMemo(() => detectEpisodes(days), [days]);

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>Your record</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          History
        </Txt>
        <Txt tone="muted" style={{ marginTop: spacing.sm }}>
          {`${logged.length} of the last ${WINDOW_DAYS} days logged`}
        </Txt>
      </Reveal>

      {average !== null ? (
        <Reveal delay={70}>
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row' }}>
              <StatTile
                value={average.toFixed(1)}
                label="Average"
                accent={palette.primary}
              />
              <StatTile
                value={String(Math.min(...logged.map((d) => d.severity ?? 10)))}
                label="Best day"
                accent={palette.bandLowText}
              />
              <StatTile
                value={String(Math.max(...logged.map((d) => d.severity ?? 0)))}
                label="Worst day"
                accent={palette.bandHighText}
              />
              <StatTile value={String(logged.length)} label="Days logged" />
            </View>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={140}>
        <Card style={{ marginTop: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing.lg,
            }}
          >
            <Txt variant="heading">Severity grid</Txt>
            <IconBadge background={palette.primarySoft} size={32}>
              <PulseIcon size={17} color={palette.primary} />
            </IconBadge>
          </View>

          <ActivityGrid days={days} onSelect={setSelected} />

          <Divider style={{ marginTop: spacing.lg }} />
          <HeatLegend />
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md }}>
            One square per day, stacked by weekday. Tap any square to see what you logged.
          </Txt>
        </Card>
      </Reveal>

      {logged.length > 1 ? (
        <Reveal delay={200}>
          <Card style={{ marginTop: spacing.md }}>
            <Txt variant="heading" style={{ marginBottom: spacing.sm }}>
              Trend
            </Txt>
            <TrendChart
              points={days.map((d) => ({ date: d.date, value: d.severity }))}
              height={140}
              showDots={false}
              interactive
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="caption" tone="faint">
                {`${WINDOW_DAYS} days ago`}
              </Txt>
              <Txt variant="caption" tone="faint">
                Today
              </Txt>
            </View>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={230}>
        <Button
          label="Backfill a missed day"
          variant="secondary"
          onPress={() => router.push('/backfill')}
          style={{ marginTop: spacing.md }}
        />
      </Reveal>

      {episodes.length > 0 ? (
        <Reveal delay={260}>
          <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Flare episodes</Kicker>
          {episodes.map((episode) => (
            <PressableScale
              key={episode.from}
              onPress={() => setSelected(episode.peakDate)}
              accessibilityLabel={`${formatLong(episode.from)} to ${formatLong(episode.to)}, peak severity ${episode.peak}`}
              scaleTo={0.99}
              style={{ marginBottom: spacing.sm }}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: palette.primary }} />
                <View style={{ flex: 1 }}>
                  <Txt variant="label">{`${formatShort(episode.from)} – ${formatShort(episode.to)}`}</Txt>
                  <Txt variant="caption" tone="faint" style={{ marginTop: 3 }}>
                    {`Peak day ${formatShort(episode.peakDate)} · ${episode.days} days`}
                  </Txt>
                </View>
                <Txt variant="label" tone="accent">
                  {episode.peak}
                </Txt>
              </Card>
            </PressableScale>
          ))}
        </Reveal>
      ) : null}

      <Modal
        visible={selected !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(10,6,24,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setSelected(null)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: palette.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: spacing.md,
              maxHeight: '86%',
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: palette.borderStrong,
              }}
            />
            {selected ? (
              <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
                <Kicker>{formatLong(selected)}</Kicker>

                {selectedCheckIn ? (
                  <>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        gap: spacing.sm,
                        marginTop: spacing.sm,
                      }}
                    >
                      <Txt variant="hero" tone="accent">
                        {selectedCheckIn.severity}
                      </Txt>
                      <Txt variant="heading" tone="muted">
                        {severityWord(selectedCheckIn.severity)}
                      </Txt>
                    </View>

                    <View style={{ marginTop: spacing.lg }}>
                      <Detail label="Itch" value={fmt(selectedCheckIn.itch)} />
                      <Detail label="Stress" value={fmt(selectedCheckIn.stress)} />
                      <Detail label="Sleep" value={fmt(selectedCheckIn.sleepHours, 'h')} />
                      <Detail label="Water" value={fmt(selectedCheckIn.waterGlasses)} />
                      <Detail label="Alcohol" value={fmt(selectedCheckIn.alcoholUnits)} />
                      <Detail label="Food" value={foodSummary(selectedCheckIn)} />
                      <Detail label="Events" value={eventSummary(selectedCheckIn)} />
                      {selectedCheckIn.notes ? (
                        <Detail label="Notes" value={selectedCheckIn.notes} />
                      ) : null}
                    </View>
                  </>
                ) : (
                  <Txt tone="muted" style={{ marginTop: spacing.md }}>
                    Nothing logged for this day.
                  </Txt>
                )}

                {/* FR-6.2: editing only inside the back-fill window. */}
                {isEditableDate(selected, today) ? (
                  <Button
                    label={selectedCheckIn ? 'Edit this day' : 'Log this day'}
                    onPress={() => {
                      const date = selected;
                      setSelected(null);
                      router.push({ pathname: '/checkin', params: { date } });
                    }}
                    style={{ marginTop: spacing.xl }}
                  />
                ) : (
                  <Txt variant="caption" tone="faint" style={{ marginTop: spacing.xl }}>
                    Days older than a week can no longer be edited.
                  </Txt>
                )}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function fmt(value: number | null, unit = ''): string {
  return value === null ? '—' : `${value}${unit}`;
}

function foodSummary(checkIn: CheckIn): string {
  const items = [
    checkIn.dietDairy && 'dairy',
    checkIn.dietGluten && 'gluten',
    checkIn.dietProcessed && 'processed',
    checkIn.dietSugar && 'sugar',
    checkIn.dietRedMeat && 'red meat',
  ].filter(Boolean) as string[];
  return items.length ? items.join(', ') : '—';
}

function eventSummary(checkIn: CheckIn): string {
  const items = [
    checkIn.illness && 'unwell',
    checkIn.soreThroat && 'sore throat',
    checkIn.skinInjury && 'skin injury',
    checkIn.newProduct && 'new product',
    checkIn.medTaken && 'treatment taken',
  ].filter(Boolean) as string[];
  return items.length ? items.join(', ') : '—';
}

function Detail({ label, value }: { label: string; value: string }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        gap: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
      <Txt variant="label" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}
