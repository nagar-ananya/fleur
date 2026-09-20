/**
 * Risk detail (REQUIREMENTS §11.1 `/risk-detail`, F3, FR-4.4).
 *
 * Explains the current number in plain language: what is pushing it up, what
 * is pulling it down, and — just as important — what the number does not mean.
 */

import React from 'react';
import { View } from 'react-native';

import { LagTimeline } from '../src/components/charts';
import { InfoIcon, TrendDownIcon, TrendUpIcon } from '../src/components/icons';
import { Reveal } from '../src/components/motion';
import {
  Card,
  FeatureCard,
  IconBadge,
  Kicker,
  Screen,
  ShortDisclaimer,
  Txt,
} from '../src/components/primitives';
import { baseVariable, explanationFor } from '../src/constants/copy';
import { model, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { bandStyle, radius, spacing } from '../src/theme';
import type { Contribution } from '../src/ml/scorer';

export default function RiskDetailScreen(): React.ReactElement {
  const { palette } = useTheme();
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

  return (
    <Screen aurora={false}>
      <Reveal>
        <FeatureCard gradient={style.gradient} padded={false}>
          <View style={{ padding: spacing.xl }}>
            <Txt variant="micro" tone="onAccent" style={{ textTransform: 'uppercase', opacity: 0.85 }}>
              Next 72 hours
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm }}>
              <Txt variant="hero" tone="onAccent">
                {`${(risk.probability * 100).toFixed(0)}%`}
              </Txt>
              <Txt variant="heading" tone="onAccent" style={{ opacity: 0.92 }}>
                {style.label}
              </Txt>
            </View>
            <Txt variant="caption" tone="onAccent" style={{ marginTop: spacing.sm, opacity: 0.9, lineHeight: 19 }}>
              {`Typical rate across the training data is ${(model.metrics.base_rate * 100).toFixed(0)}%.`}
            </Txt>
          </View>
        </FeatureCard>
      </Reveal>

      <Reveal delay={70}>
        <Kicker style={{ marginTop: spacing.xl }}>Pushing it up</Kicker>
      </Reveal>

      {risk.drivers.length === 0 ? (
        <Card style={{ marginTop: spacing.md }}>
          <Txt tone="muted">Nothing is standing out as a contributor right now.</Txt>
        </Card>
      ) : (
        risk.drivers.map((driver, index) => (
          <Reveal key={driver.name} delay={110 + index * 60}>
            <FactorCard contribution={driver} raises />
          </Reveal>
        ))
      )}

      {risk.protective.length > 0 ? (
        <>
          <Reveal delay={220}>
            <Kicker style={{ marginTop: spacing.xl }}>Helping</Kicker>
          </Reveal>
          {risk.protective.map((item, index) => (
            <Reveal key={item.name} delay={260 + index * 60}>
              <FactorCard contribution={item} raises={false} />
            </Reveal>
          ))}
        </>
      ) : null}

      <Reveal delay={340}>
        <Card style={{ marginTop: spacing.xl }} tone="alt">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge background={palette.surface} size={34}>
              <InfoIcon size={18} color={palette.textMuted} />
            </IconBadge>
            <Txt variant="heading">How to read this</Txt>
          </View>
          <Txt tone="muted" style={{ lineHeight: 23, marginTop: spacing.md }}>
            This number comes from a model trained on simulated patients, not on your own
            history. It describes how closely your recent pattern resembles the ones that came
            before flares in that data. It is an association, not a cause, and a high reading
            does not mean a flare is coming — many do not.
          </Txt>
          <Txt tone="muted" style={{ lineHeight: 23, marginTop: spacing.md }}>
            Nothing here is a reason to change your treatment. If your skin is worsening, that
            is a conversation for your clinician.
          </Txt>
        </Card>
      </Reveal>

      <ShortDisclaimer />
    </Screen>
  );
}

function FactorCard({
  contribution,
  raises,
}: {
  contribution: Contribution;
  raises: boolean;
}): React.ReactElement {
  const { palette } = useTheme();
  const explanation = explanationFor(baseVariable(contribution.name));
  const tint = raises ? palette.bandHighText : palette.bandLowText;
  const soft = raises ? palette.bandHighSoft : palette.bandLowSoft;

  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconBadge background={soft} size={36}>
          {raises ? (
            <TrendUpIcon size={18} color={tint} />
          ) : (
            <TrendDownIcon size={18} color={tint} />
          )}
        </IconBadge>
        <View style={{ flex: 1 }}>
          <Txt variant="label">{contribution.label}</Txt>
          <Txt variant="caption" style={{ color: tint, marginTop: 1 }}>
            {raises ? 'Raising your risk' : 'Lowering your risk'}
          </Txt>
        </View>
      </View>

      <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 21 }}>
        {explanation.description}
      </Txt>

      <View
        style={{
          marginTop: spacing.md,
          backgroundColor: palette.surfaceAlt,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
        }}
      >
        <LagTimeline from={explanation.lagFrom} to={explanation.lagTo} />
      </View>
    </Card>
  );
}
