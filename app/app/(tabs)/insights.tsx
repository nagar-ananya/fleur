/**
 * Insights — the 12 rules over time (REQUIREMENTS §11.4, FR-5.x).
 *
 * The score page answers "why is today's score what it is"; this screen
 * answers "which rules usually add the most for me". Same 12 rules, same
 * numbers (`ruleNumber`), same cards, but each shows the average points it
 * added per day over the last 30 scored days, biggest first. Tapping one
 * opens the same `/factor-detail` page as the score breakdown.
 *
 * §11.4's preamble is kept verbatim above the list, and §13.4 rules out
 * calling anything "your #1 trigger" — the highlight says "adding the most
 * lately" instead. The elimination test is not shown here for now (its hook,
 * `useEliminationTest`, is untouched).
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ChevronRight } from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import { Card, Kicker, Screen, ShortDisclaimer, Txt } from '../../src/components/primitives';
import { INSIGHTS_PREAMBLE } from '../../src/constants/copy';
import { loadFeatureInputRows } from '../../src/db/queries';
import { rulebook, useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { buildDailyFrame, MIN_HISTORY_DAYS } from '../../src/logic/frame';
import { ruleAverages, scoredDayCount } from '../../src/logic/personal';
import { ruleNumber } from '../../src/logic/rulebook';
import { radius, spacing } from '../../src/theme';
import { todayLocal } from '../../src/utils/dates';

/** How many recent days to average over. */
const WINDOW_DAYS = 30;

interface Row {
  id: string;
  label: string;
  /** Average points added per day, one decimal. */
  average: number;
}

export default function InsightsScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db, risk } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(0);

  useEffect(() => {
    if (!db) return;
    // Each scored day needs two weeks behind it, so load that much extra.
    void loadFeatureInputRows(db, todayLocal(), WINDOW_DAYS + MIN_HISTORY_DAYS).then((input) => {
      const frame = buildDailyFrame(input);
      const byId = new Map(ruleAverages(frame, rulebook).map((r) => [r.id, r.averagePoints]));
      setRows(
        rulebook.rules
          .map((rule) => ({
            id: rule.id,
            label: rule.label,
            average: Math.round((byId.get(rule.id) ?? 0) * 10) / 10,
          }))
          .sort((a, b) => rank(a) - rank(b) || Math.abs(b.average) - Math.abs(a.average)),
      );
      setDays(scoredDayCount(frame));
    });
  }, [db, risk]);

  const top = rows.find((r) => r.average > 0) ?? null;
  const biggest = Math.max(1, ...rows.map((r) => Math.abs(r.average)));
  const open = (row: Row): void =>
    router.push({ pathname: '/factor-detail', params: { ruleId: row.id, label: row.label } });

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>Over time</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          Your rules
        </Txt>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          {`Points each rule added on an average day, over your last ${WINDOW_DAYS} days.`}
        </Txt>
      </Reveal>

      {days === 0 ? (
        <Reveal delay={60}>
          <Card style={{ marginTop: spacing.xl }}>
            <Txt variant="heading">Not enough days yet</Txt>
            <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
              {`Log ${MIN_HISTORY_DAYS} days of check-ins and your patterns will show up here.`}
            </Txt>
          </Card>
        </Reveal>
      ) : (
        <>
          {top ? (
            <Reveal delay={60}>
              <PressableScale onPress={() => open(top)} accessibilityLabel={`Adding the most lately: ${top.label}`}>
                <Card level={2} style={{ marginTop: spacing.xl, backgroundColor: palette.bandHighSoft }}>
                  <Kicker style={{ color: palette.bandHighText }}>Adding the most lately</Kicker>
                  <Txt variant="heading" style={{ marginTop: spacing.sm, lineHeight: 26 }}>
                    {`Rule ${ruleNumber(top.id)} · ${top.label}`}
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
                    <Txt variant="display" style={{ color: palette.bandHighText }}>
                      {`+${top.average}`}
                    </Txt>
                    <Txt tone="muted" style={{ paddingBottom: 6 }}>
                      points a day
                    </Txt>
                  </View>
                </Card>
              </PressableScale>
            </Reveal>
          ) : null}

          <Reveal delay={110}>
            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.xl, lineHeight: 19 }}>
              {INSIGHTS_PREAMBLE}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: spacing.lg,
                marginBottom: spacing.sm,
              }}
            >
              <Kicker>{`All ${rulebook.rules.length} rules`}</Kicker>
              <Kicker>Per day</Kicker>
            </View>
            <View style={{ gap: spacing.sm }}>
              {rows.map((row) => (
                <RuleAverageRow key={row.id} row={row} biggest={biggest} onPress={() => open(row)} />
              ))}
            </View>
            <Txt variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: spacing.lg }}>
              {`Based on ${days} scored ${days === 1 ? 'day' : 'days'}. Tap a rule to see its chart.`}
            </Txt>
          </Reveal>
        </>
      )}

      <Reveal delay={160}>
        <TestedCard />
      </Reveal>

      <ShortDisclaimer />
    </Screen>
  );
}

/** Adds first, then takes off, then nothing. */
function rank(row: Row): number {
  if (row.average > 0) return 0;
  if (row.average < 0) return 1;
  return 2;
}

function RuleAverageRow({
  row,
  biggest,
  onPress,
}: {
  row: Row;
  biggest: number;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const active = row.average !== 0;
  const raises = row.average > 0;
  const tint = !active ? palette.textFaint : raises ? palette.bandHighText : palette.bandLowText;
  const fill = raises ? palette.bandHighFill : palette.bandLowFill;
  const value = !active ? '0' : raises ? `+${row.average}` : `−${-row.average}`;
  const width = `${Math.max(3, (Math.abs(row.average) / biggest) * 100)}%` as const;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Rule ${ruleNumber(row.id)}: ${row.label}, ${value} points a day`}
      scaleTo={0.98}
    >
      <Card style={{ opacity: active ? 1 : 0.6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.surfaceAlt,
            }}
          >
            <Txt variant="label" tone="muted">
              {ruleNumber(row.id)}
            </Txt>
          </View>
          <Txt style={{ flex: 1, lineHeight: 21 }}>{row.label}</Txt>
          <Txt variant="heading" style={{ color: tint, minWidth: 48, textAlign: 'right' }}>
            {value}
          </Txt>
          <ChevronRight size={14} color={palette.textFaint} />
        </View>
        {active ? (
          <View
            style={{
              height: 10,
              marginTop: spacing.md,
              marginLeft: 30 + spacing.md,
              borderRadius: radius.pill,
              backgroundColor: palette.surfaceAlt,
              overflow: 'hidden',
            }}
          >
            <View style={{ width, height: 10, borderRadius: radius.pill, backgroundColor: fill }} />
          </View>
        ) : null}
      </Card>
    </PressableScale>
  );
}

/** The rulebook's own test results, stated as being about the test set. */
function TestedCard(): React.ReactElement {
  const { palette } = useTheme();
  const { results } = rulebook;
  const tile = (value: number, label: string, color: string): React.ReactElement => (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: palette.surfaceAlt,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
      }}
    >
      <Txt variant="display" style={{ color }}>
        {`${Math.round(value * 100)}%`}
      </Txt>
      <Txt variant="caption" tone="muted" center style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );

  return (
    <Card style={{ marginTop: spacing.xl }}>
      <Txt variant="heading">How we tested Fleur</Txt>
      <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
        {`We ran the ${rulebook.rules.length} rules on ${results.tested_on_days.toLocaleString()} days of simulated patients. How often did a flare follow?`}
      </Txt>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        {tile(results.flare_rate_when_high, 'when Fleur said High', palette.bandHighText)}
        {tile(results.flare_rate_when_low, 'when Fleur said Low', palette.bandLowText)}
      </View>
      <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 19 }}>
        Simulated data, not real patients, and not clinically tested.
      </Txt>
    </Card>
  );
}
