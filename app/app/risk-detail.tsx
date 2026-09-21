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
import { flareFrequencyReading } from '../src/constants/copy';
import { model, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { ELIMINATION_CANDIDATES } from '../src/hooks/useEliminationTest';
import { ELEVATED_BAND_RATIO } from '../src/ml/scorer';
import { bandStyle, spacing } from '../src/theme';
import type { Contribution } from '../src/ml/scorer';

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
  const percent = Math.round(risk.probability * 100);
  const ceiling = model.threshold * 1.5;
  const elevatedStart = model.threshold * ELEVATED_BAND_RATIO;
  const lowWidth = (elevatedStart / ceiling) * 100;
  const elevatedWidth = ((model.threshold - elevatedStart) / ceiling) * 100;
  const highWidth = 100 - lowWidth - elevatedWidth;

  const allContributions = [...risk.drivers, ...risk.protective];
  const nonZero = model.features.filter((f) => f.coefficient !== 0);
  const sumOfContributions = allContributions.reduce((t, c) => t + c.contribution, 0);
  const logit = model.intercept + sumOfContributions;

  return (
    <Screen aurora={false} contentStyle={{ paddingBottom: 100 }}>
      <Stack.Screen options={{ title: `What ${percent}% means` }} />
      <Reveal>
        <Txt variant="title">{`What ${percent}% means`}</Txt>
      </Reveal>

      <Reveal delay={30}>
        <Card level={2} style={{ marginTop: spacing.lg, borderColor: style.text, borderWidth: 1 }}>
          <Txt tone="muted" style={{ lineHeight: 22 }}>
            {flareFrequencyReading(percent)}
          </Txt>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Meaning good text="It is the chance a flare starts — nothing about how severe or how long it would be." />
          <Meaning text="It is not how much of your skin is affected, and not a score out of 100." />
          <Meaning text="It is not a prediction that a flare will happen — on most days like today, none did." />
        </View>
      </Reveal>

      <Reveal delay={110}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          {`Why it reads "${style.label}"`}
        </Kicker>
        <Txt tone="muted" style={{ lineHeight: 21 }}>
          Bands are fixed fractions of the model's own decision threshold, not a comparison
          against other people or against your own history.
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
          {`Fleur z-scores ${model.features.length} lagged features against the training set, multiplies each by its coefficient and sums them onto an intercept of ${model.intercept.toFixed(2)}. `}
          {`${nonZero.length} features are non-zero for you right now.`}
        </Txt>
      </Reveal>

      {allContributions.length > 0 ? (
        <Reveal delay={190}>
          <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Signed contributions</Kicker>
          {allContributions.map((c) => (
            <ContributionRow
              key={c.name}
              contribution={c}
              onPress={() =>
                router.push({ pathname: '/factor-detail', params: { name: c.name, label: c.label } })
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
            <Txt variant="caption" tone="faint">Sum + intercept</Txt>
            <Txt variant="caption" tone="accent">
              {`${logit.toFixed(2)} → ${percent}%`}
            </Txt>
          </View>
        </Reveal>
      ) : null}

      <Reveal delay={230}>
        <Card tone="alt" level={1} style={{ marginTop: spacing.xl }}>
          <Txt tone="muted" style={{ lineHeight: 23 }}>
            This number comes from a model trained on simulated patients, not on your own
            history. It describes how closely your recent pattern resembles the ones that came
            before flares in that data — an association, not a cause. Nothing here is a reason
            to change your treatment.
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
  contribution,
  onPress,
}: {
  contribution: Contribution;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const raises = contribution.contribution > 0;
  const tint = raises ? palette.bandHighText : palette.bandLowText;
  const barWidth = Math.min(100, Math.abs(contribution.contribution) * 80);
  const base = contribution.name.split('_lag')[0]?.split('_roll')[0] ?? contribution.name;
  const eliminable = ELIMINATION_CANDIDATES[base] !== undefined;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${contribution.label}, ${raises ? 'raises' : 'lowers'} risk`}
      scaleTo={0.99}
      style={{ paddingVertical: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1}>{contribution.label}</Txt>
        </View>
        <Txt variant="caption" style={{ color: tint }}>
          {`${contribution.contribution > 0 ? '+' : ''}${contribution.contribution.toFixed(2)}`}
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
