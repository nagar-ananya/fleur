/**
 * Factor detail — one rule, chart first. Reachable from the score breakdown
 * (`/risk-detail`), Insights' trigger list and a Reset session's "why this is
 * here" line.
 *
 * Shows today's points, a big line of the points this rule added each day
 * over the last two weeks (scored the same way as today, from
 * `risk.history`), and two short lines: what the rule looks at and why it is
 * in the rulebook.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { RuleChart } from '../src/components/charts';
import { WindIcon } from '../src/components/icons';
import { Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { explanationFor } from '../src/constants/copy';
import { categoryForVariable, planItemFor } from '../src/constants/reset';
import { rulebook, useApp } from '../src/hooks/appState';
import type { Rule } from '../src/logic/rulebook';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';

/** What each rule's column measures, in words a reader would use. */
const MEASURES: Readonly<Record<string, string>> = {
  severity_delta: 'how far your skin is above its two-week average',
  stress: 'stress level',
  sleep_hours: 'hours of sleep',
  itch: 'itch level',
  alcohol_units: 'drinks a day',
  diet_processed: 'processed-food days',
  pm2_5: 'air pollution (PM2.5)',
  temp_delta_1d: 'temperature change (°C)',
  uv_index_max: 'UV index',
};

/** "Average stress level, 7 to 14 days ago. At 2 → 0 points; at 8 → +15 points." */
function whatItLooksAt(rule: Rule): string {
  const { column, how, from = 0, to = 0 } = rule.look_at;
  const window =
    how === 'today' ? 'today' : from === 0 ? `over the last ${to + 1} days` : `${from} to ${to} days ago`;
  const full = `${rule.points > 0 ? '+' : '−'}${Math.abs(rule.points)}`;

  // Yes/no questions (unwell, sore throat, skin injury).
  if (how === 'highest' && rule.low === 0 && rule.high === 1) {
    return `Checks whether you logged it ${window}. No → 0 points. Yes → ${full} points.`;
  }
  const measure = MEASURES[column] ?? 'value';
  const lead =
    how === 'average'
      ? `Average ${measure}`
      : how === 'total'
        ? `Number of ${measure}`
        : how === 'highest'
          ? `Highest ${measure}`
          : how === 'lowest'
            ? `Biggest ${measure}`
            : `Your ${measure}`;
  return `${lead} ${window}. At ${rule.low} → 0 points. At ${rule.high} → ${full} points.`;
}

function firstSentence(text: string): string {
  return text.match(/^[^.]*\./)?.[0] ?? text;
}

function signed(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '0';
}

export default function FactorDetailScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { risk } = useApp();
  const params = useLocalSearchParams<{ ruleId?: string; label?: string; points?: string }>();
  const ruleId = params.ruleId ?? '';

  const rule = useMemo(() => rulebook.rules.find((r) => r.id === ruleId), [ruleId]);
  const base = rule?.variable ?? ruleId;
  const explanation = explanationFor(base);
  const label = params.label ?? rule?.label ?? ruleId;
  const raises = (rule?.points ?? 1) >= 0;
  const tint = raises ? palette.bandHighText : palette.bandLowText;
  const line = raises ? palette.bandHighFill : palette.bandLowFill;
  const max = Math.abs(rule?.points ?? 0);

  const ready = risk.status === 'ready' ? risk : null;
  const todayRule = ready?.rules.find((r) => r.id === ruleId);
  // The list passes its rounded value so both screens show the same number.
  const today = params.points !== undefined ? Number(params.points) : todayRule ? Math.round(todayRule.points) : null;

  const history = useMemo(
    () =>
      (ready?.history ?? []).map((day) => {
        const r = day.rules.find((x) => x.id === ruleId);
        return { date: day.date, value: r ? Math.abs(r.points) : null };
      }),
    [ready, ruleId],
  );

  const resetCategory = categoryForVariable(base);
  const resetPlan = resetCategory && resetCategory !== 'mood' ? planItemFor(resetCategory) : null;

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: 100 }}>
      <Stack.Screen options={{ title: 'Rule' }} />

      <Reveal>
        <Txt variant="heading" style={{ lineHeight: 26 }}>
          {label}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
          <Txt variant="display" style={{ color: tint }}>
            {today === null ? '—' : signed(today)}
          </Txt>
          <Txt tone="muted" style={{ paddingBottom: 6 }}>
            {today === null ? 'no data today' : `points today · max ${raises ? '+' : '−'}${max}`}
          </Txt>
        </View>
      </Reveal>

      {history.length > 1 && rule ? (
        <Reveal delay={60}>
          <Card level={2} style={{ marginTop: spacing.lg }}>
            <Kicker style={{ marginBottom: spacing.md }}>
              {raises ? 'Points added · last 2 weeks' : 'Points taken off · last 2 weeks'}
            </Kicker>
            <RuleChart points={history} max={max} color={line} />
            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
              {`Dashed line = the most this rule can ${raises ? 'add' : 'take off'} (${max}).`}
            </Txt>
          </Card>
        </Reveal>
      ) : null}

      {rule ? (
        <Reveal delay={110}>
          <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>What it looks at</Kicker>
          <Txt tone="muted" style={{ lineHeight: 22 }}>
            {whatItLooksAt(rule)}
          </Txt>
        </Reveal>
      ) : null}

      <Reveal delay={160}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Why it matters</Kicker>
        <Txt tone="muted" style={{ lineHeight: 22 }}>
          {firstSentence(explanation.description)}
        </Txt>
      </Reveal>

      {resetPlan ? (
        <Reveal delay={210}>
          <Button
            label={`Try: ${resetPlan.title}`}
            icon={<WindIcon size={17} color={palette.onAccent} />}
            onPress={() => router.push({ pathname: resetPlan.pathname, params: resetPlan.params } as never)}
            style={{ marginTop: spacing.xl }}
          />
        </Reveal>
      ) : null}
    </Screen>
  );
}
