/**
 * Risk detail — "What X% means" (REQUIREMENTS §11.1 `/risk-detail`, F3,
 * FR-4.4) — v2 redesign.
 *
 * Restructured around the source design: a plain-language reading of the
 * number, why the band reads the way it does (against your own band
 * boundaries, not a population norm), the calculation walkthrough (real
 * intercept + real signed contributions, summing to the actual logit), then
 * the same contributions as a tappable list into `/factor-detail`.
 *
 * Every number here is real: `model.intercept`, `model.threshold`,
 * `ELEVATED_BAND_RATIO`, and the contributions `scorer.ts` already computed.
 * Nothing is fabricated to match the source design's illustrative numbers.
 */

import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ChevronRight } from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import {
  Card,
  Kicker,
  Screen,
  ShortDisclaimer,
  Txt,
} from '../src/components/primitives';
import { scoreReading } from '../src/constants/copy';
import { rulebook, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { ELIMINATION_CANDIDATES } from '../src/hooks/useEliminationTest';

import { bandStyle, spacing } from '../src/theme';
import type { RuleScore } from '../src/logic/engine';

export default function RiskDetailScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { risk } = useApp();

  if (risk.status !== 'ready') {
    return (
      <Screen aurora={false}>
        <Card>
          <Txt tone="muted">
            There is no risk value to explain right now. Keep logging daily check-ins and it
            will appear here.
          </Txt>
        </Card>
      </Screen>
    );
  }

  const style = bandStyle(risk.band, palette);
  const score = risk.score;

  // Band zones as plain fractions of the 0-100 scale, so the strip can never
  // disagree with the label.
  const lowWidth = rulebook.bands.elevated;
  const elevatedWidth = rulebook.bands.high - rulebook.bands.elevated;
  const highWidth = 100 - rulebook.bands.high;

  // Every rule that scored, not just the top few — otherwise the total below
  // would not match the number at the top, and this screen exists to be added up.
  const allRules = [...risk.rules]
    .filter((r) => Math.abs(r.points) >= 0.05)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const shownTotal = allRules.reduce((t, r) => t + r.points, 0);

  return (
    <Screen aurora={false} contentStyle={{ paddingBottom: 100 }}>
      <Stack.Screen options={{ title: `How ${score} points add up` }} />
      <Reveal>
        <Txt variant="title">{`How ${score} points add up`}</Txt>
      </Reveal>

      <Reveal delay={30}>
        <Card level={2} style={{ marginTop: spacing.lg, borderColor: style.text, borderWidth: 1 }}>
          <Txt tone="muted" style={{ lineHeight: 22 }}>
            {scoreReading(score, risk.drivers.length)}
          </Txt>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Meaning good text="It is a tally of the risk factors stacking up today — you can add it up yourself below." />
          <Meaning text="It is not a percentage chance, and not how much of your skin is affected." />
          <Meaning text="It says nothing about how severe or how long a flare would be." />
        </View>
      </Reveal>

      <Reveal delay={110}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          {`Why it reads "${style.label}"`}
        </Kicker>
        <Txt tone="muted" style={{ lineHeight: 21 }}>
          {`Under ${rulebook.bands.elevated} is low, ${rulebook.bands.elevated} to ${rulebook.bands.high - 1} is elevated, ${rulebook.bands.high} and above is higher than usual. Fixed marks on the scale — not a comparison against other people.`}
        </Txt>
        <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: spacing.md }}>
          <View style={{ width: `${lowWidth}%`, backgroundColor: palette.bandLowFill }} />
          <View style={{ width: `${elevatedWidth}%`, backgroundColor: palette.bandElevatedFill }} />
          <View style={{ width: `${highWidth}%`, backgroundColor: palette.bandHighFill }} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
          <Txt variant="micro" tone="faint" style={{ width: `${lowWidth}%` }}>LOW</Txt>
          <Txt variant="micro" tone="faint" style={{ width: `${elevatedWidth}%` }}>ELEVATED</Txt>
          <Txt variant="micro" tone="faint" style={{ flex: 1 }}>HIGHER</Txt>
        </View>
      </Reveal>

      <Reveal delay={150}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>How it is calculated</Kicker>
        <Txt tone="muted" style={{ lineHeight: 21 }}>
          {`Fleur checks ${rulebook.rules.length} rules against your last two weeks. Each one is worth up to a set number of points, and earns a share of them depending on how far along its range you are. Add them up, cap at 100. That is the whole calculation — no training, no hidden weights.`}
        </Txt>
      </Reveal>

      {allRules.length > 0 ? (
        <Reveal delay={190}>
          <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Points today</Kicker>
          {allRules.map((r) => (
            <ContributionRow
              key={r.id}
              rule={r}
              onPress={() =>
                router.push({ pathname: '/factor-detail', params: { ruleId: r.id, label: r.label } })
              }
            />
          ))}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: spacing.md,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: palette.border,
            }}
          >
            <Txt variant="caption" tone="faint">Total</Txt>
            <Txt variant="caption" tone="accent">
              {`${shownTotal.toFixed(1)} → ${score} points`}
            </Txt>
          </View>
        </Reveal>
      ) : null}

      <Reveal delay={230}>
        <Card tone="alt" level={1} style={{ marginTop: spacing.xl }}>
          <Txt tone="muted" style={{ lineHeight: 23 }}>
            The rules and their point values were written from published research on how long
            each trigger takes to show up in the skin — not learned from your own history. Every
            one is an association, not a cause. Nothing here is a reason to change your
            treatment.
          </Txt>
        </Card>
      </Reveal>

      <ShortDisclaimer />
    </Screen>
  );
}

function Meaning({ text, good = false }: { text: string; good?: boolean }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Txt style={{ color: good ? palette.bandLowText : palette.textFaint }}>{good ? '✓' : '·'}</Txt>
      <Txt tone="muted" style={{ flex: 1, lineHeight: 21 }}>
        {text}
      </Txt>
    </View>
  );
}

function ContributionRow({
  rule,
  onPress,
}: {
  rule: RuleScore;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const raises = rule.points > 0;
  const tint = raises ? palette.bandHighText : palette.bandLowText;
  // Bar shows how much of the rule's own maximum it earned.
  const barWidth = Math.min(100, Math.abs(rule.points / rule.maxPoints) * 100);
  const eliminable = ELIMINATION_CANDIDATES[rule.variable] !== undefined;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${rule.label}, ${Math.abs(rule.points).toFixed(1)} of ${Math.abs(rule.maxPoints)} points, ${raises ? 'raises' : 'lowers'} risk`}
      scaleTo={0.99}
      style={{ paddingVertical: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1}>{rule.label}</Txt>
        </View>
        <Txt variant="caption" style={{ color: tint }}>
          {`${raises ? '+' : '−'}${Math.abs(rule.points).toFixed(1)} of ${Math.abs(rule.maxPoints)}`}
        </Txt>
        <ChevronRight size={14} color={palette.textFaint} />
      </View>
      <View
        style={{
          height: 5,
          marginTop: 6,
          backgroundColor: palette.surfaceAlt,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${barWidth}%`,
            height: 5,
            borderRadius: 3,
            backgroundColor: raises ? palette.bandHighFill : palette.bandLowFill,
          }}
        />
      </View>
      {eliminable ? (
        <Txt variant="caption" tone="faint" style={{ marginTop: 4 }}>
          Eligible for an elimination test — see Insights
        </Txt>
      ) : null}
    </PressableScale>
  );
}
