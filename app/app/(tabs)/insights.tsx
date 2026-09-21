/**
 * Insights — the trigger profile (REQUIREMENTS §11.4, FR-5.x).
 *
 * These are the model's coefficients, which *are* the trigger profile — that
 * is the whole argument for L1 logistic regression in §8.4. The preamble in
 * §11.4 is required verbatim, and §13.4 forbids ever calling anything "your #1
 * trigger".
 *
 * v2 redesign additions: tapping a bar now opens the dedicated `/factor-detail`
 * screen (was an in-page bottom sheet); a static lag-reference table; and a
 * real elimination test (`useEliminationTest`) rather than a decorative card.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
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
import { model } from '../../src/hooks/appState';
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

  // FR-5.1: top 8 by absolute standardised coefficient. Renders correctly when
  // the model has fewer than 8 nonzero coefficients (§11.4).
  const bars = useMemo<FactorBar[]>(
    () =>
      [...model.features]
        .filter((f) => f.coefficient !== 0)
        .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
        .slice(0, TOP_N)
        .map((f) => ({
          name: f.name,
          // FR-5.2: never render a raw feature name.
          label: f.label,
          value: f.coefficient,
          direction: f.direction,
        })),
    [],
  );

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
        <Card style={{ marginTop: spacing.lg }}>
          {bars.length === 0 ? (
            <Txt tone="muted">
              This model has no active factors, which usually means it was trained with very
              strong regularisation.
            </Txt>
          ) : (
            <DivergingBars
              bars={bars}
              onSelect={(bar) =>
                router.push({ pathname: '/factor-detail', params: { name: bar.name, label: bar.label } })
              }
            />
          )}
        </Card>
      </Reveal>

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
            The model looks back 14 days, so the 14–21 day streptococcal window is only partly
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
            <Txt variant="heading">About this model</Txt>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
            <StatTile
              value={model.metrics.average_precision.toFixed(2)}
              label="Average precision"
              accent={palette.primary}
            />
            <StatTile
              value={model.metrics.base_rate.toFixed(2)}
              label="Base rate"
              accent={palette.textMuted}
            />
            <StatTile
              value={`${model.metrics.n_train_patients}`}
              label="Patients trained on"
              accent={palette.aqua}
            />
          </View>

          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.lg, lineHeight: 19 }}>
            Version {model.model_version} · L1 logistic regression · {model.horizon_hours}-hour
            horizon. Built from simulated data, so it describes patterns across many people
            rather than your own history, and it has not been clinically validated.
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

  const candidate = useMemo(() => {
    for (const bar of bars) {
      const match = ELIMINATION_CANDIDATES[bar.name];
      if (match) return { variable: bar.name, label: match };
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
