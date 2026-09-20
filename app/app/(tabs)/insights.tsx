/**
 * Insights — the trigger profile (REQUIREMENTS §11.4, FR-5.x).
 *
 * These are the model's coefficients, which *are* the trigger profile — that
 * is the whole argument for L1 logistic regression in §8.4. The preamble in
 * §11.4 is required verbatim, and §13.4 forbids ever calling anything "your #1
 * trigger".
 */

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { DivergingBars, LagTimeline, type FactorBar } from '../../src/components/charts';
import { InfoIcon, SparkIcon } from '../../src/components/icons';
import { Reveal } from '../../src/components/motion';
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
import {
  INSIGHTS_PREAMBLE,
  INSIGHTS_SUBTITLE,
  baseVariable,
  explanationFor,
} from '../../src/constants/copy';
import { model } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { radius, spacing } from '../../src/theme';

const TOP_N = 8; // FR-5.1

export default function InsightsScreen(): React.ReactElement {
  const { palette } = useTheme();
  const [selected, setSelected] = useState<FactorBar | null>(null);

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
            <DivergingBars bars={bars} onSelect={setSelected} />
          )}
        </Card>
      </Reveal>

      <Reveal delay={200}>
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

      {/* FR-5.4: tapping a bar opens a detail sheet. */}
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
                marginBottom: spacing.md,
              }}
            />
            {selected ? <FactorSheet bar={selected} onClose={() => setSelected(null)} /> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function FactorSheet({
  bar,
  onClose,
}: {
  bar: FactorBar;
  onClose: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const explanation = explanationFor(baseVariable(bar.name));
  const raises = bar.direction === 'increases';
  const tint = raises ? palette.bandHighText : palette.bandLowText;
  const soft = raises ? palette.bandHighSoft : palette.bandLowSoft;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm }}>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: soft,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          marginBottom: spacing.md,
        }}
      >
        <Txt variant="caption" style={{ color: tint, fontWeight: '600' }}>
          {raises ? 'Associated with higher risk' : 'Associated with lower risk'}
        </Txt>
      </View>

      <Txt variant="title">{bar.label}</Txt>

      <Txt tone="muted" style={{ marginTop: spacing.lg, lineHeight: 23 }}>
        {explanation.description}
      </Txt>

      <Kicker style={{ marginTop: spacing.xl }}>When it typically shows up</Kicker>
      <View style={{ marginTop: spacing.sm }}>
        <LagTimeline from={explanation.lagFrom} to={explanation.lagTo} />
      </View>
      <Txt variant="caption" tone="muted" style={{ marginTop: spacing.sm, lineHeight: 19 }}>
        {explanation.typicalLag}
      </Txt>
      {explanation.lagTo > 14 ? (
        <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm, lineHeight: 19 }}>
          The dashed line marks 14 days — the furthest back Fleur can look. Part of this window
          sits beyond it.
        </Txt>
      ) : null}

      <Button
        label="Close"
        variant="secondary"
        onPress={onClose}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}
