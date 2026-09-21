/**
 * Settings → Model & disclaimer — split out of the old single-page Settings.
 */

import React from 'react';
import { View } from 'react-native';

import { Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { DISCLAIMER_FULL } from '../src/constants/copy';
import { model } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';

export default function SettingsModelScreen(): React.ReactElement {
  const { palette } = useTheme();

  const facts = [
    { k: 'MODEL TYPE', v: model.model_type },
    { k: 'HORIZON', v: `${model.horizon_hours} hours` },
    { k: 'FEATURES', v: `${model.features.length} non-zero` },
    { k: 'THRESHOLD', v: model.threshold.toFixed(2) },
    { k: 'TRAINED', v: model.trained_at.slice(0, 10) },
    { k: 'VERSION', v: model.model_version },
  ];

  const metrics = [
    { k: 'Average precision', v: model.metrics.average_precision.toFixed(2), w: model.metrics.average_precision },
    { k: 'Precision at threshold', v: model.metrics.precision_at_threshold.toFixed(2), w: model.metrics.precision_at_threshold },
    { k: 'Recall at threshold', v: model.metrics.recall_at_threshold.toFixed(2), w: model.metrics.recall_at_threshold },
  ];

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted">v{model.model_version} · bundled, never downloaded</Txt>

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

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Held-out performance</Kicker>
      <Card>
        {metrics.map((metric) => (
          <View key={metric.k} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt>{metric.k}</Txt>
              <Txt variant="caption" tone="accent">
                {metric.v}
              </Txt>
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: palette.surfaceAlt, marginTop: spacing.xs, overflow: 'hidden' }}>
              <View style={{ height: 5, width: `${Math.min(100, metric.w * 100)}%`, borderRadius: 3, backgroundColor: palette.primary }} />
            </View>
          </View>
        ))}
        <Txt variant="caption" tone="faint" style={{ lineHeight: 18 }}>
          {`Measured on ${model.metrics.n_test_patients} simulated patients never seen in training. The base rate is ${model.metrics.base_rate.toFixed(2)}, so this is a real lift — useful, not clinical.`}
        </Txt>
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
