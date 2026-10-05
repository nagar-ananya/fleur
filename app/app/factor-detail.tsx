import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { RuleChart } from '../src/components/charts';
import { WindIcon } from '../src/components/icons';
import { Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { explanationFor } from '../src/constants/copy';
import { categoryForVariable, categoryPath } from '../src/constants/reset';
import { ruleHow, type RuleHow } from '../src/constants/rules';
import { rulebook, useApp } from '../src/hooks/appState';
import { wholePointsById } from '../src/logic/engine';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';

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
  const params = useLocalSearchParams<{ ruleId?: string; label?: string }>();
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
  const today = ready ? (wholePointsById(ready.rules, rulebook).get(ruleId) ?? null) : null;

  const history = useMemo(
    () =>
      (ready?.history ?? []).map((day) => {
        const r = day.rules.find((x) => x.id === ruleId);
        return { date: day.date, value: r ? Math.abs(r.points) : null };
      }),
    [ready, ruleId],
  );

  const resetCategory = categoryForVariable(base);
  const how = rule ? ruleHow(rule) : null;

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: 100 }}>
      <Stack.Screen options={{ title: 'Rule' }} />

      <Reveal>
        <Txt variant="title" style={{ lineHeight: 32 }}>
          {label}
        </Txt>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <PointsBox
            title="Today's points"
            value={today === null ? '—' : signed(today)}
            color={tint}
          />
          <PointsBox title="Maximum points" value={signed(rule?.points ?? 0)} />
        </View>
      </Reveal>

      {history.length > 1 && rule ? (
        <Reveal delay={60}>
          <Card level={2} style={{ marginTop: spacing.lg }}>
            <Kicker style={{ marginBottom: spacing.md }}>
              {raises ? 'Points added in the last 2 weeks' : 'Points taken off in the last 2 weeks'}
            </Kicker>
            <RuleChart points={history} max={max} color={line} />
            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
              {`Dashed line = the most this rule can ${raises ? 'add' : 'take off'} (${max}).`}
            </Txt>
          </Card>
        </Reveal>
      ) : null}

      {how && rule ? (
        <Reveal delay={110}>
          <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>How it works</Kicker>
          <HowItWorks how={how} />
        </Reveal>
      ) : null}

      <Reveal delay={160}>
        <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Why it matters</Kicker>
        <Txt tone="muted" style={{ lineHeight: 22 }}>
          {firstSentence(explanation.description)}
        </Txt>
      </Reveal>

      {resetCategory ? (
        <Reveal delay={210}>
          <Button
            label={`Try: ${resetCategory.title}`}
            icon={<WindIcon size={17} color={palette.onAccent} />}
            onPress={() => router.push(categoryPath(resetCategory.key) as never)}
            style={{ marginTop: spacing.xl }}
          />
        </Reveal>
      ) : null}
    </Screen>
  );
}

function PointsBox({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color?: string;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
    >
      <Txt variant="caption" tone="muted">
        {title}
      </Txt>
      <Txt variant="display" style={{ color: color ?? palette.text, marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

function HowItWorks({ how }: { how: RuleHow }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.sm }}>
        <Txt variant="label" style={{ flex: 1 }}>
          {how.heading}
        </Txt>
        <Txt variant="label">Points</Txt>
      </View>
      {how.rows.map((row) => (
        <View
          key={row.reading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: palette.border,
          }}
        >
          <Txt style={{ flex: 1 }}>{row.reading}</Txt>
          <Txt
            variant="heading"
            style={{
              color:
                row.points === 0
                  ? palette.textFaint
                  : row.points > 0
                    ? palette.bandHighText
                    : palette.bandLowText,
            }}
          >
            {signed(row.points)}
          </Txt>
        </View>
      ))}
    </Card>
  );
}
