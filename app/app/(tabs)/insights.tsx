/**
 * Insights — the trigger profile (REQUIREMENTS §11.4, FR-5.x).
 *
 * Two charts: what has actually been driving this person's score (averaged
 * over their own logged days), and what the rulebook watches in general. The
 * §11.4 preamble is required verbatim, and §13.4 forbids ever calling anything
 * "your #1 trigger".
 *
 * v2 redesign additions: tapping a bar now opens the dedicated `/factor-detail`
 * screen (was an in-page bottom sheet); a static lag-reference table; and a
 * real elimination test (`useEliminationTest`) rather than a decorative card.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { DivergingBars, type FactorBar } from '../../src/components/charts';
import { FlaskIcon, InfoIcon, SparkIcon } from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import {
  Button,
  Card,
  IconBadge,
  Kicker,
  Screen,
  ShortDisclaimer,
  StatTile,
  Txt,
} from '../../src/components/primitives';
import { INSIGHTS_PREAMBLE, INSIGHTS_SUBTITLE } from '../../src/constants/copy';
import { ELIMINATION_CANDIDATES, useEliminationTest } from '../../src/hooks/useEliminationTest';
import { rulebook, useApp } from '../../src/hooks/appState';
import { buildDailyFrame } from '../../src/logic/frame';
import { ruleAverages, scoredDayCount } from '../../src/logic/personal';
import { loadFeatureInputRows } from '../../src/db/queries';
import { todayLocal } from '../../src/utils/dates';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing } from '../../src/theme';

const TOP_N = 8; // FR-5.1

const LAG_REFERENCE: readonly { name: string; days: string }[] = [
  { name: 'Cold snap / humidity drop', days: '1–3 days' },
  { name: 'Sleep deprivation', days: '3–7 days' },
  { name: 'Psychological stress', days: '7–14 days' },
  { name: 'Skin injury (Koebner)', days: '10–14 days' },
  { name: 'Streptococcal sore throat', days: '14–21 days' },
];

export default function InsightsScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db, risk } = useApp();
  const [personal, setPersonal] = useState<{ bars: FactorBar[]; days: number }>({
    bars: [],
    days: 0,
  });

  // Averaged over the person's own logged days, not over simulated patients.
  useEffect(() => {
    if (!db) return;
    void loadFeatureInputRows(db, todayLocal(), 120).then((rows) => {
      const frame = buildDailyFrame(rows);
      setPersonal({
        bars: ruleAverages(frame, rulebook)
          .slice(0, TOP_N)
          .map((r) => ({
            name: r.id,
            label: r.label,
            value: r.averagePoints,
            direction: r.averagePoints >= 0 ? 'increases' : 'decreases',
          })),
        days: scoredDayCount(frame),
      });
    });
  }, [db, risk]);

  // What Fleur watches and how heavily — authored, the same for everyone.
  const rulebookBars = useMemo<FactorBar[]>(
    () =>
      [...rulebook.rules]
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
        .slice(0, TOP_N)
        .map((r) => ({
          name: r.id,
          label: r.label,
          value: r.points,
          direction: r.points >= 0 ? 'increases' : 'decreases',
        })),
    [],
  );

  const bars = personal.bars.length > 0 ? personal.bars : rulebookBars;

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>Trigger profile</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          What moves with flares
        </Txt>
        <Txt tone="muted" style={{ marginTop: spacing.sm }}>
          {INSIGHTS_SUBTITLE}
        </Txt>
      </Reveal>

      {/* §11.4 required copy, verbatim. */}
      <Reveal delay={70}>
        <Card
          tone="alt"
          style={{
            marginTop: spacing.lg,
            borderColor: palette.primary,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.md,
          }}
        >
          <IconBadge background={palette.primarySoft} size={34}>
            <InfoIcon size={18} color={palette.primary} />
          </IconBadge>
          <Txt variant="caption" style={{ flex: 1, lineHeight: 20 }}>
            {INSIGHTS_PREAMBLE}
          </Txt>
        </Card>
      </Reveal>

      <Reveal delay={140}>
        <Kicker style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {personal.bars.length > 0 ? 'What is driving your score' : 'What Fleur looks at'}
        </Kicker>
        <Card>
          {personal.bars.length > 0 ? (
            <DivergingBars
              bars={personal.bars}
              onSelect={(bar) =>
                router.push({ pathname: '/factor-detail', params: { ruleId: bar.name, label: bar.label } })
              }
            />
          ) : (
            <DivergingBars
              bars={rulebookBars}
              onSelect={(bar) =>
                router.push({ pathname: '/factor-detail', params: { ruleId: bar.name, label: bar.label } })
              }
            />
          )}
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 19 }}>
            {personal.bars.length > 0
              ? `Average points each factor has added across your own ${personal.days} scored ${personal.days === 1 ? 'day' : 'days'}.`
              : 'Points each rule can add, written from published research on trigger timing — not learned from your data or anyone else’s. Your own numbers appear here once you have two weeks logged.'}
          </Txt>
        </Card>
      </Reveal>

      {personal.bars.length > 0 ? (
        <Reveal delay={165}>
          <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
            What Fleur looks at
          </Kicker>
          <Card>
            <DivergingBars
              bars={rulebookBars}
              onSelect={(bar) =>
                router.push({ pathname: '/factor-detail', params: { ruleId: bar.name, label: bar.label } })
              }
            />
            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 19 }}>
              Points each rule can add at most. Written from published research on how long each
              trigger takes to show up — not learned from your data or anyone else’s.
            </Txt>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={190}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Typical lag · trigger to flare
        </Kicker>
        <Card>
          {LAG_REFERENCE.map((row, index) => (
            <View
              key={row.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: palette.border,
              }}
            >
              <View style={{ width: 2, height: 16, borderRadius: 1, backgroundColor: palette.primary }} />
              <Txt style={{ flex: 1 }}>{row.name}</Txt>
              <Txt variant="caption" tone="accent">
                {row.days}
              </Txt>
            </View>
          ))}
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 18 }}>
            Fleur looks back 14 days, so the 14–21 day streptococcal window is only partly
            covered — a documented limitation.
          </Txt>
        </Card>
      </Reveal>

      <EliminationTestCard bars={bars} />

      <Reveal delay={280}>
        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge background={palette.aquaSoft} size={34}>
              <SparkIcon size={18} color={palette.aqua} />
            </IconBadge>
            <Txt variant="heading">How well it does</Txt>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
            <StatTile
              value={`${Math.round(rulebook.results.flare_rate_when_high * 100)}%`}
              label="Flare followed, top band"
              accent={palette.primary}
            />
            <StatTile
              value={`${Math.round(rulebook.results.flare_rate_when_low * 100)}%`}
              label="Flare followed, low band"
              accent={palette.textMuted}
            />
            <StatTile
              value={`${rulebook.rules.length}`}
              label="Rules"
              accent={palette.aqua}
            />
          </View>

          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.lg, lineHeight: 19 }}>
            Version {rulebook.rulebook_version} · {rulebook.rules.length}-rule points system ·{' '}
            {rulebook.horizon_hours}-hour horizon. Tested on{' '}
            {rulebook.results.tested_on_days.toLocaleString()} days from simulated patients held
            back from the design, so these describe the test set — not your own history — and
            nothing here has been clinically validated.
          </Txt>
        </Card>
      </Reveal>

      <ShortDisclaimer />
    </Screen>
  );
}

/**
 * Genuinely functional: picks a candidate from the current top drivers
 * (never an unrelated variable), starts/tracks a real 14-day test, and
 * compares real logged severity across the two halves once it completes.
 */
function EliminationTestCard({ bars }: { bars: readonly FactorBar[] }): React.ReactElement | null {
  const { palette } = useTheme();
  const { state, loaded, start, clear } = useEliminationTest();

  // `bar.name` is a rule id; the elimination list is keyed by base variable.
  const candidate = useMemo(() => {
    for (const bar of bars) {
      const variable = rulebook.rules.find((r) => r.id === bar.name)?.variable;
      const match = variable ? ELIMINATION_CANDIDATES[variable] : undefined;
      if (variable && match) return { variable, label: match };
    }
    return null;
  }, [bars]);

  if (!loaded) return null;
  if (state.status === 'none' && !candidate) return null;

  return (
    <Reveal delay={230}>
      <Card
        style={{
          marginTop: spacing.lg,
          borderColor: palette.primary,
          borderWidth: 1,
          backgroundColor: palette.primarySoft,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBadge background={palette.surface} size={34}>
            <FlaskIcon size={17} color={palette.primary} />
          </IconBadge>
          <Kicker tone="accent">Elimination test</Kicker>
        </View>

        {state.status === 'none' && candidate ? (
          <>
            <Txt variant="heading" style={{ marginTop: spacing.md }}>
              {`Test ${candidate.label.toLowerCase()} for two weeks`}
            </Txt>
            <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
              One week logging as usual, one week without. Fleur compares your own average
              severity across both — not a controlled trial, but the most direct thing you can
              do with your own data.
            </Txt>
            <Button
              label="Start the test"
              onPress={() => start(candidate.variable, candidate.label)}
              style={{ marginTop: spacing.lg }}
            />
          </>
        ) : null}

        {state.status === 'running' ? (
          <>
            <Txt variant="heading" style={{ marginTop: spacing.md }}>
              {`Testing ${state.label.toLowerCase()} · day ${state.day} of 14`}
            </Txt>
            <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
              {state.phase === 'usual'
                ? `Week 1: log ${state.label.toLowerCase()} as usual in your daily check-in.`
                : `Week 2: avoid ${state.label.toLowerCase()} entirely, and keep logging.`}
            </Txt>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: palette.surface, marginTop: spacing.lg, overflow: 'hidden' }}>
              <View style={{ height: 4, width: `${(state.day / 14) * 100}%`, backgroundColor: palette.primary }} />
            </View>
            <PressableScale onPress={clear} accessibilityLabel="Cancel test" style={{ marginTop: spacing.md, minHeight: 32 }}>
              <Txt variant="caption" tone="faint">
                Cancel test
              </Txt>
            </PressableScale>
          </>
        ) : null}

        {state.status === 'complete' ? (
          <>
            <Txt variant="heading" style={{ marginTop: spacing.md }}>
              {`${state.label} · result`}
            </Txt>
            {state.week1Mean !== null && state.week2Mean !== null ? (
              <>
                <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md }}>
                  <StatTile value={state.week1Mean.toFixed(1)} label="Week 1 · as usual" />
                  <StatTile value={state.week2Mean.toFixed(1)} label="Week 2 · avoided" />
                </View>
                <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 20 }}>
                  {describeDelta(state.week1Mean, state.week2Mean, state.label)}
                </Txt>
              </>
            ) : (
              <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
                Too few check-ins across the two weeks for a fair comparison.
              </Txt>
            )}
            <Button label="Start a new test" variant="secondary" onPress={clear} style={{ marginTop: spacing.lg }} />
          </>
        ) : null}
      </Card>
    </Reveal>
  );
}

function describeDelta(week1: number, week2: number, label: string): string {
  const delta = Math.round((week2 - week1) * 10) / 10;
  if (Math.abs(delta) < 0.3) {
    return `Barely any difference — average severity moved by ${Math.abs(delta).toFixed(1)}. This isn't a controlled comparison, so treat it as a data point, not an answer.`;
  }
  const direction = delta < 0 ? 'lower' : 'higher';
  return `Average severity was ${Math.abs(delta).toFixed(1)} points ${direction} while avoiding ${label.toLowerCase()}. Two weeks with everything else unchanged is not proof, but it's worth noticing.`;
}
