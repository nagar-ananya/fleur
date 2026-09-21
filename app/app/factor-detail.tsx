/**
 * Factor detail — a dedicated screen in the v2 redesign, replacing the
 * bottom-sheet `FactorSheet` that used to live inline in Insights. Reachable
 * from Insights' trigger list, from Today's risk-detail contributions, and
 * from a Reset session's "why this is here" line.
 *
 * Everything shown is either the model's own coefficient (real) or the
 * curated per-variable copy already in `constants/copy.ts` (real, written
 * for this project). The source design's per-factor "evidence" bullets are
 * deliberately not reproduced — they read as computed per-feature validation
 * stats, and no such per-feature stats exist in `metrics.json`. Manufacturing
 * them would be exactly the kind of fabricated authority §11.5 and the
 * project's honesty bar rule out.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { LagTimeline } from '../src/components/charts';
import { WindIcon } from '../src/components/icons';
import { Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { baseVariable, explanationFor } from '../src/constants/copy';
import { categoryForVariable, planItemFor } from '../src/constants/reset';
import { model } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';

export default function FactorDetailScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; label?: string }>();
  const name = params.name ?? '';

  const feature = useMemo(() => model.features.find((f) => f.name === name), [name]);
  const base = baseVariable(name);
  const explanation = explanationFor(base);
  const raises = (feature?.direction ?? 'increases') === 'increases';
  const label = params.label ?? feature?.label ?? name;
  const tint = raises ? palette.bandHighText : palette.bandLowText;
  const soft = raises ? palette.bandHighSoft : palette.bandLowSoft;

  const nonZero = model.features.filter((f) => f.coefficient !== 0);
  const rank = feature
    ? [...nonZero].sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient)).findIndex((f) => f.name === feature.name) + 1
    : null;

  const resetCategory = categoryForVariable(base);
  const resetPlan = resetCategory ? planItemFor(resetCategory) : null;

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Stack.Screen options={{ title: label }} />
      <Reveal>
        <View style={{ alignSelf: 'flex-start', backgroundColor: soft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
          <Txt variant="caption" style={{ color: tint, fontWeight: '600' }}>
            {raises ? 'Associated with higher risk' : 'Associated with lower risk'}
          </Txt>
        </View>
        <Txt variant="title" style={{ marginTop: spacing.md }}>
          {label}
        </Txt>
      </Reveal>

      {feature ? (
        <Reveal delay={60}>
          <Card level={2} style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <Txt variant="display" style={{ color: tint }}>
                {feature.coefficient > 0 ? '+' : ''}
                {feature.coefficient.toFixed(2)}
              </Txt>
              <Txt tone="muted" style={{ paddingBottom: 4, lineHeight: 17 }}>
                {'standardized coefficient'}
                {rank ? `\n${rank === 1 ? 'strongest' : `#${rank}`} of ${nonZero.length} non-zero features` : ''}
              </Txt>
            </View>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={110}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>What this means</Kicker>
        <Txt tone="muted" style={{ lineHeight: 22 }}>
          {explanation.description}
        </Txt>
      </Reveal>

      <Reveal delay={160}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Typical lag</Kicker>
        <LagTimeline from={explanation.lagFrom} to={explanation.lagTo} />
        <Txt variant="caption" tone="muted" style={{ marginTop: spacing.sm, lineHeight: 19 }}>
          {explanation.typicalLag}
        </Txt>
        {explanation.lagTo > 14 ? (
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm, lineHeight: 19 }}>
            The dashed line marks 14 days — the furthest back Fleur can look. Part of this
            window sits beyond it.
          </Txt>
        ) : null}
      </Reveal>

      <Reveal delay={210}>
        <Card tone="alt" level={1} style={{ marginTop: spacing.xl }}>
          <Kicker>Honest caveat</Kicker>
          <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 21 }}>
            This is an association, not a cause, and it comes from a model trained on simulated
            patients — not on your own history. It is not your "number one trigger", and Fleur
            will never call it that.
          </Txt>
        </Card>
      </Reveal>

      {resetPlan ? (
        <Reveal delay={260}>
          <Button
            label={`Open ${resetPlan.title.toLowerCase()}`}
            icon={<WindIcon size={17} color={palette.onAccent} />}
            onPress={() => router.push({ pathname: resetPlan.pathname, params: resetPlan.params } as never)}
            style={{ marginTop: spacing.xl }}
          />
        </Reveal>
      ) : null}
    </Screen>
  );
}
