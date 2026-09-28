/**
 * Settings → Scoring & disclaimer.
 *
 * The one place project-level test results are shown. These describe how the
 * rulebook did on held-back simulated patients — they are never presented on
 * Today as a claim about the person's own risk.
 */

import React from 'react';
import { View } from 'react-native';

import { Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { DISCLAIMER_FULL } from '../src/constants/copy';
import { rulebook } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';

export default function SettingsModelScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { results, bands } = rulebook;

  const facts = [
    { k: 'SCORING', v: `${rulebook.rules.length}-rule points system` },
    { k: 'HORIZON', v: `${rulebook.horizon_hours} hours` },
    { k: 'BANDS', v: `${bands.elevated} / ${bands.high}` },
    { k: 'WRITTEN', v: rulebook.authored_at },
    { k: 'VERSION', v: rulebook.rulebook_version },
  ];

  const bandRates = [
    { k: 'Said "high"', v: results.flare_rate_when_high },
    { k: 'Said "low"', v: results.flare_rate_when_low },
  ];

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted">v{rulebook.rulebook_version} · runs on this phone, nothing downloaded</Txt>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl }}>
        {facts.map((fact) => (
          <View key={fact.k} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <Card>
              <Txt variant="micro" tone="faint">
                {fact.k}
              </Txt>
              <Txt variant="label" style={{ marginTop: spacing.sm }}>
                {fact.v}
              </Txt>
            </Card>
          </View>
        ))}
      </View>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        How often a flare followed
      </Kicker>
      <Card>
        {bandRates.map((row) => (
          <View key={row.k} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt>{row.k}</Txt>
              <Txt variant="caption" tone="accent">
                {`${Math.round(row.v * 100)}%`}
              </Txt>
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: palette.surfaceAlt, marginTop: spacing.xs, overflow: 'hidden' }}>
              <View style={{ height: 5, width: `${Math.min(100, row.v * 100)}%`, borderRadius: 3, backgroundColor: palette.primary }} />
            </View>
          </View>
        ))}
        <Txt variant="caption" tone="faint" style={{ lineHeight: 18 }}>
          {`Measured on ${results.tested_on_days.toLocaleString()} days of simulated patients. Useful, not clinical.`}
        </Txt>
      </Card>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        How the score works
      </Kicker>
      <Card>
        <Txt tone="muted" style={{ lineHeight: 22 }}>
          {`Fleur checks ${rulebook.rules.length} rules against your last two weeks. Each rule comes from published research on what can set off a flare, and adds up to a set number of points. Add them up and you get your score, from 0 to 100.`}
        </Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Txt variant="caption" tone="faint">Base rate (any random day)</Txt>
          <Txt variant="caption" tone="muted">{`${Math.round(results.base_rate * 100)}%`}</Txt>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
          <Txt variant="caption" tone="faint">Flares caught by the top band</Txt>
          <Txt variant="caption" tone="accent">{`${Math.round(results.recall_at_high * 100)}%`}</Txt>
        </View>
      </Card>

      <Card tone="alt" level={1} style={{ marginTop: spacing.xl, borderRadius: radius.lg }}>
        <Kicker>Full disclaimer</Kicker>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 21 }}>
          {DISCLAIMER_FULL}
        </Txt>
      </Card>
    </Screen>
  );
}
