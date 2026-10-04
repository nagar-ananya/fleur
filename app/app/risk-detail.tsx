/**
 * Risk detail — "How your score adds up" (REQUIREMENTS §11.1 `/risk-detail`).
 *
 * Kept deliberately short: the score, where it sits on the band scale, and
 * a plain table of all the rulebook's rules (fixed rulebook order, the same
 * numbers the check-in uses) showing the whole points each one added today
 * out of its maximum. The rounded points add up to the total printed under
 * them (`wholeParts`), so the table can be checked by hand. Rows are not
 * tappable — what each rule means, and its chart, live on the Rules tab.
 */

import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ChevronRight } from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import { Card, Kicker, Screen, ShortDisclaimer, Txt } from '../src/components/primitives';
import { rulebook, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { wholePointsById } from '../src/logic/engine';
import { bandStyle, radius, spacing } from '../src/theme';

interface Row {
  id: string;
  label: string;
  /** Whole points added today, or null when the rule had no data to look at. */
  points: number | null;
  /** Most the rule can add (negative for rules that take points off). */
  max: number;
}

export default function RiskDetailScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { risk } = useApp();

  if (risk.status !== 'ready') {
    return (
      <Screen aurora={false} edges={[]}>
        <Card>
          <Txt tone="muted">
            There is no score to explain yet. Keep logging daily check-ins and it will appear here.
          </Txt>
        </Card>
      </Screen>
    );
  }

  const style = bandStyle(risk.band, palette);
  const score = risk.score;

  const partById = wholePointsById(risk.rules, rulebook);
  // Fixed rulebook order, so "Rule 3" here is "Rule 3" in the check-in too.
  const rows: Row[] = rulebook.rules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    points: partById.get(rule.id) ?? null,
    max: rule.points,
  }));
  const total = [...partById.values()].reduce((t, v) => t + v, 0);

  const { elevated, high } = rulebook.bands;

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: 100 }}>
      <Stack.Screen options={{ title: 'How your score adds up' }} />

      <Reveal>
        <Card level={2}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Txt variant="hero" style={{ color: style.text }}>
              {score}
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt variant="label">points today</Txt>
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  backgroundColor: style.soft,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                }}
              >
                <Txt variant="caption" style={{ color: style.text, fontWeight: '600' }}>
                  {style.label}
                </Txt>
              </View>
            </View>
          </View>

          <BandScale score={score} elevated={elevated} high={high} />

          <Txt tone="muted" style={{ marginTop: spacing.lg, lineHeight: 22 }}>
            {`Fleur checks ${rulebook.rules.length} rules. Each one adds points. Add them up and you get your score.`}
          </Txt>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <Card style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <Kicker>{`The ${rulebook.rules.length} rules`}</Kicker>
            <Kicker>Today / max</Kicker>
          </View>
          {rows.map((row, i) => (
            <RuleRow key={row.id} number={i + 1} row={row} />
          ))}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: spacing.md,
              borderTopWidth: 2,
              borderTopColor: palette.borderStrong,
            }}
          >
            <Txt variant="heading" style={{ flex: 1 }}>
              Total
            </Txt>
            <Txt variant="heading" style={{ color: style.text }}>
              {total === score ? `${score}` : `${total} → ${score}`}
            </Txt>
          </View>
          {total !== score ? (
            <Txt variant="caption" tone="faint" style={{ textAlign: 'right', marginTop: 2 }}>
              {total > score ? 'The score tops out at 100' : 'The score never goes below 0'}
            </Txt>
          ) : null}
        </Card>

        <PressableScale
          onPress={() => router.navigate('/rules')}
          accessibilityLabel="What do these rules mean? Open Rules"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginTop: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          <Txt variant="label" tone="accent">
            What do these rules mean? See Rules
          </Txt>
          <ChevronRight size={16} color={palette.primary} />
        </PressableScale>
      </Reveal>

      <ShortDisclaimer />
    </Screen>
  );
}

/** Low / elevated / higher strip with a marker where today's score sits. */
function BandScale({
  score,
  elevated,
  high,
}: {
  score: number;
  elevated: number;
  high: number;
}): React.ReactElement {
  const { palette } = useTheme();
  const at = Math.min(100, Math.max(0, score));
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ height: 14, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ width: `${elevated}%`, backgroundColor: palette.bandLowFill }} />
          <View style={{ width: `${high - elevated}%`, backgroundColor: palette.bandElevatedFill }} />
          <View style={{ flex: 1, backgroundColor: palette.bandHighFill }} />
        </View>
        <View
          style={{
            position: 'absolute',
            left: `${at}%`,
            marginLeft: -7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: palette.surface,
            borderWidth: 3,
            borderColor: palette.text,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
        <Txt variant="micro" tone="faint" style={{ width: `${elevated}%` }}>LOW</Txt>
        <Txt variant="micro" tone="faint" style={{ width: `${high - elevated}%` }}>ELEVATED</Txt>
        <Txt variant="micro" tone="faint" style={{ flex: 1 }}>HIGH</Txt>
      </View>
    </View>
  );
}

function RuleRow({ number, row }: { number: number; row: Row }): React.ReactElement {
  const { palette } = useTheme();
  const active = row.points !== null && row.points !== 0;
  const tint = !active
    ? palette.textFaint
    : (row.points ?? 0) > 0
      ? palette.bandHighText
      : palette.bandLowText;
  const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  const today = row.points === null ? '—' : signed(row.points);
  const spoken =
    row.points === null
      ? 'no data yet'
      : `${row.points >= 0 ? 'added' : 'took off'} ${Math.abs(row.points)} of ${Math.abs(row.max)} points`;

  return (
    <View
      accessible
      accessibilityLabel={`Rule ${number}: ${row.label}, ${spoken}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        opacity: active ? 1 : 0.55,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.surfaceAlt,
        }}
      >
        <Txt variant="caption" tone="muted" style={{ fontWeight: '700' }}>
          {number}
        </Txt>
      </View>
      <Txt style={{ flex: 1, lineHeight: 21 }}>{row.label}</Txt>
      <Txt style={{ minWidth: 72, textAlign: 'right' }}>
        <Txt variant="heading" style={{ color: tint }}>
          {today}
        </Txt>
        <Txt tone="faint">{` / ${signed(row.max)}`}</Txt>
      </Txt>
    </View>
  );
}
