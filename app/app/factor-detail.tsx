/**
 * Factor detail — a dedicated screen in the v2 redesign, replacing the
 * bottom-sheet `FactorSheet` that used to live inline in Insights. Reachable
 * from Insights' trigger list, from Today's risk-detail contributions, and
 * from a Reset session's "why this is here" line.
 *
 * Everything shown is either the rule's own point value (real) or the
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
import { explanationFor } from '../src/constants/copy';
import { categoryForVariable, planItemFor } from '../src/constants/reset';
import { rulebook } from '../src/hooks/appState';
import type { Rule } from '../src/logic/rulebook';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';

/** Plain-English version of a rule's window and its two marks. */
function ruleWindowReading(rule: Rule): string {
  const { how, from = 0, to = 0 } = rule.look_at;
  const window =
    how === 'today'
      ? 'today'
      : from === 0
        ? `over the last ${to + 1} days`
        : `between ${to} and ${from} days ago`;
  const measure =
    how === 'average' ? 'Average' : how === 'total' ? 'Number of days' : how === 'highest' ? 'Highest' : how === 'lowest' ? 'Lowest' : 'Value';
  return `${measure} ${window}. Scores nothing at ${rule.low}, the full ${Math.abs(rule.points)} points at ${rule.high}.`;
}

export default function FactorDetailScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ ruleId?: string; label?: string }>();
  const ruleId = params.ruleId ?? '';

  const rule = useMemo(() => rulebook.rules.find((r) => r.id === ruleId), [ruleId]);
  const base = rule?.variable ?? ruleId;
  const explanation = explanationFor(base);
  const raises = (rule?.points ?? 1) >= 0;
  const label = params.label ?? rule?.label ?? ruleId;
  const tint = raises ? palette.bandHighText : palette.bandLowText;
  const soft = raises ? palette.bandHighSoft : palette.bandLowSoft;

  const rank = rule
    ? [...rulebook.rules]
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
        .findIndex((r) => r.id === rule.id) + 1
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

      {rule ? (
        <Reveal delay={60}>
          <Card level={2} style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <Txt variant="display" style={{ color: tint }}>
                {rule.points > 0 ? '+' : ''}
                {rule.points}
              </Txt>
              <Txt tone="muted" style={{ paddingBottom: 4, lineHeight: 17 }}>
                {'points at most'}
                {rank ? `\n${rank === 1 ? 'heaviest' : `#${rank}`} of ${rulebook.rules.length} rules` : ''}
              </Txt>
            </View>
            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 19 }}>
              {ruleWindowReading(rule)}
            </Txt>
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
            This is an association, not a cause. The point value was written from published
            research on trigger timing, not learned from your own history. It is not your
            "number one trigger", and Fleur will never call it that.
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
