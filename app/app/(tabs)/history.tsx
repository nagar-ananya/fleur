/**
 * History (REQUIREMENTS §11, FR-6.x).
 *
 * A month calendar of the last three months, each day coloured by skin
 * severity (0-10). Tapping a day opens a sheet with that day's skin severity
 * and flare score side by side — clearly labelled, since they are on
 * different scales — then the check-in answers in rule order. Editing is
 * offered only inside the 7-day back-fill window (FR-6.2).
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { MonthCalendar, SeverityLegend } from '../../src/components/charts';
import { ArrowLeftIcon, ChevronRight } from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import { Button, Card, Kicker, Pill, Screen, Txt } from '../../src/components/primitives';
import { CHECKIN_QUESTIONS, type CheckInQuestion } from '../../src/constants/checkin';
import { listCheckIns, loadFeatureInputRows } from '../../src/db/queries';
import { rulebook, useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { bandFor, scoreDay } from '../../src/logic/engine';
import { buildDailyFrame, canPredict, MIN_HISTORY_DAYS } from '../../src/logic/frame';
import { ruleNumber } from '../../src/logic/rulebook';
import { bandStyle, radius, severityWord, spacing } from '../../src/theme';
import type { CheckIn } from '../../src/types/models';
import { formatLong, isEditableDate, monthLabel, todayLocal } from '../../src/utils/dates';

/** How many months back the calendar goes, this one included. */
const MONTHS_SHOWN = 3;

/** 'YYYY-MM-01' of the month `offset` months from the one `date` is in. */
function monthStart(date: string, offset = 0): string {
  const [y, m] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export default function HistoryScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db } = useApp();
  const today = todayLocal();
  const earliest = monthStart(today, -(MONTHS_SHOWN - 1));

  const [checkIns, setCheckIns] = useState<Map<string, CheckIn>>(new Map());
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [month, setMonth] = useState(() => monthStart(today));
  const [selected, setSelected] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      void listCheckIns(db, earliest, today).then((rows) => {
        setCheckIns(new Map(rows.map((row) => [row.date, row])));
      });
      // Each day's flare score, worked out exactly as Today's is. Days
      // without two weeks behind them have no score.
      void loadFeatureInputRows(db, today, 31 * MONTHS_SHOWN + MIN_HISTORY_DAYS).then((rows) => {
        const frame = buildDailyFrame(rows);
        const next = new Map<string, number>();
        frame.dates.forEach((date, i) => {
          if (i >= MIN_HISTORY_DAYS && canPredict(frame, i)) {
            next.set(date, scoreDay(frame, i, rulebook).score);
          }
        });
        setScores(next);
      });
    }, [db, earliest, today]),
  );

  const severities = new Map([...checkIns].map(([date, c]) => [date, c.severity]));
  const loggedThisMonth = [...checkIns.keys()].filter((d) => d.startsWith(month.slice(0, 8))).length;
  const canGoBack = month > earliest;
  const canGoForward = month < monthStart(today);
  const selectedCheckIn = selected ? (checkIns.get(selected) ?? null) : null;
  const selectedScore = selected ? (scores.get(selected) ?? null) : null;

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>Your record</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          History
        </Txt>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          How your skin was each day. Tap a day to see more.
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <MonthArrow
              direction="back"
              enabled={canGoBack}
              onPress={() => setMonth(monthStart(month, -1))}
            />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Txt variant="heading">{monthLabel(month)}</Txt>
              <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
                {`${loggedThisMonth} ${loggedThisMonth === 1 ? 'day' : 'days'} logged`}
              </Txt>
            </View>
            <MonthArrow
              direction="forward"
              enabled={canGoForward}
              onPress={() => setMonth(monthStart(month, 1))}
            />
          </View>

          <MonthCalendar month={month} severities={severities} today={today} onSelect={setSelected} />

          <SeverityLegend style={{ marginTop: spacing.lg }} />
        </Card>
      </Reveal>

      <Reveal delay={130}>
        <Button
          label="Log a missed day"
          variant="secondary"
          onPress={() => router.push('/backfill')}
          style={{ marginTop: spacing.md }}
        />
      </Reveal>

      <Modal
        visible={selected !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(31,29,26,0.35)', justifyContent: 'flex-end' }}
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
                <Txt variant="heading">{formatLong(selected)}</Txt>

                {selectedCheckIn ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                      <DayNumber
                        title="Skin"
                        value={`${selectedCheckIn.severity}`}
                        outOf="/ 10"
                        note={severityWord(selectedCheckIn.severity)}
                      />
                      <DayNumber
                        title="Flare score"
                        value={selectedScore === null ? '—' : `${selectedScore}`}
                        outOf={selectedScore === null ? '' : '/ 100'}
                        note={selectedScore === null ? 'Not enough days yet' : undefined}
                        band={selectedScore === null ? undefined : bandFor(selectedScore, rulebook)}
                      />
                    </View>

                    <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
                      Your answers
                    </Kicker>
                    {CHECKIN_QUESTIONS.map((q) => (
                      <Answer key={q.rule} question={q} checkIn={selectedCheckIn} />
                    ))}
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

function MonthArrow({
  direction,
  enabled,
  onPress,
}: {
  direction: 'back' | 'forward';
  enabled: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={!enabled}
      accessibilityLabel={direction === 'back' ? 'Previous month' : 'Next month'}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.surfaceAlt,
        opacity: enabled ? 1 : 0.3,
      }}
    >
      {direction === 'back' ? (
        <ArrowLeftIcon size={18} color={palette.text} />
      ) : (
        <ChevronRight size={18} color={palette.text} />
      )}
    </PressableScale>
  );
}

/** One of the two headline numbers in the day sheet. */
function DayNumber({
  title,
  value,
  outOf,
  note,
  band,
}: {
  title: string;
  value: string;
  outOf: string;
  note?: string;
  band?: 'low' | 'elevated' | 'high';
}): React.ReactElement {
  const { palette } = useTheme();
  const style = band ? bandStyle(band, palette) : null;
  return (
    <View style={{ flex: 1, backgroundColor: palette.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
      <Kicker>{title}</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: spacing.xs }}>
        <Txt variant="display" style={style ? { color: style.text } : undefined}>
          {value}
        </Txt>
        <Txt tone="faint">{outOf}</Txt>
      </View>
      {style ? (
        <Pill label={style.label} color={style.text} background={style.soft} />
      ) : note ? (
        <Txt variant="caption" tone="muted">
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

function Answer({ question, checkIn }: { question: CheckInQuestion; checkIn: CheckIn }): React.ReactElement {
  const { palette } = useTheme();
  const raw = checkIn[question.field];
  const value =
    raw === null
      ? '—'
      : question.kind === 'yesno'
        ? raw
          ? 'Yes'
          : 'No'
        : question.kind === 'count'
          ? `${raw} ${question.unit}`
          : `${raw} / 10`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <Txt variant="caption" tone="faint" style={{ width: 52 }}>
        {`Rule ${ruleNumber(question.rule)}`}
      </Txt>
      <Txt style={{ flex: 1 }}>{question.short}</Txt>
      <Txt variant="label">{value}</Txt>
    </View>
  );
}
