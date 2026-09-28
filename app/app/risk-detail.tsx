/**
 * Risk detail — "How your score adds up" (REQUIREMENTS §11.1 `/risk-detail`).
 *
 * Kept deliberately short: the score, where it sits on the band scale, and
 * all of the rulebook's rules as a numbered list with the whole points each
 * one added today. The rounded points add up to the total printed under
 * them (`wholeParts`), so the list can be checked by hand. Tapping a rule
 * opens its two-week chart on `/factor-detail`.
 */

import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ChevronRight } from '../src/components/icons';
import { PressableScale, Reveal } from '../src/components/motion';
import { Card, Kicker, Screen, ShortDisclaimer, Txt } from '../src/components/primitives';
import { rulebook, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { wholeParts } from '../src/logic/engine';
import { bandStyle, radius, spacing } from '../src/theme';

interface Row {
  id: string;
  label: string;
  /** Whole points added today, or null when the rule had no data to look at. */
  points: number | null;
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

  const scored = rulebook.rules.map((rule) => risk.rules.find((r) => r.id === rule.id) ?? null);
  const present = scored.filter((r) => r !== null);
  const parts = wholeParts(present.map((r) => r.points));
  const partById = new Map(present.map((r, i) => [r.id, parts[i]]));
  const rows: Row[] = rulebook.rules
    .map((rule) => ({ id: rule.id, label: rule.label, points: partById.get(rule.id) ?? null }))
    .sort((a, b) => rank(a) - rank(b) || (b.points ?? 0) - (a.points ?? 0));
  const total = parts.reduce((t, v) => t + v, 0);

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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.xl,
            marginBottom: spacing.sm,
          }}
        >
          <Kicker>{`The ${rulebook.rules.length} rules`}</Kicker>
          <Kicker>Points</Kicker>
        </View>
        <View style={{ gap: spacing.sm }}>
          {rows.map((row, i) => (
            <RuleRow
              key={row.id}
              number={i + 1}
              row={row}
              onPress={() =>
                router.push({
                  pathname: '/factor-detail',
                  params: {
                    ruleId: row.id,
                    label: row.label,
                    ...(row.points === null ? {} : { points: String(row.points) }),
                  },
                })
              }
            />
          ))}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing.md,
            paddingTop: spacing.md,
            paddingHorizontal: spacing.md,
            borderTopWidth: 1,
            borderTopColor: palette.border,
          }}
        >
          <Txt variant="label" style={{ flex: 1 }}>
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

        <Txt variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: spacing.xl }}>
          Tap a rule to see its last two weeks.
        </Txt>
      </Reveal>

      <ShortDisclaimer />
    </Screen>
  );
}

/** Adds first, then takes-off, then zero, then no data. */
function rank(row: Row): number {
  if (row.points === null) return 3;
  if (row.points === 0) return 2;
  return row.points > 0 ? 0 : 1;
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

function RuleRow({
  number,
  row,
  onPress,
}: {
  number: number;
  row: Row;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const active = row.points !== null && row.points !== 0;
  const tint =
    row.points === null || row.points === 0
      ? palette.textFaint
      : row.points > 0
        ? palette.bandHighText
        : palette.bandLowText;
  const value =
    row.points === null ? '—' : row.points > 0 ? `+${row.points}` : row.points < 0 ? `−${-row.points}` : '0';
  const spoken =
    row.points === null
      ? 'no data yet'
      : row.points >= 0
        ? `adds ${row.points} points`
        : `takes off ${-row.points} points`;

  return (
    <PressableScale onPress={onPress} accessibilityLabel={`Rule ${number}: ${row.label}, ${spoken}`} scaleTo={0.98}>
      <Card padded={false} style={{ opacity: active ? 1 : 0.6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.surfaceAlt,
            }}
          >
            <Txt variant="label" tone="muted">
              {number}
            </Txt>
          </View>
          <Txt style={{ flex: 1, lineHeight: 21 }}>{row.label}</Txt>
          <Txt variant="heading" style={{ color: tint, minWidth: 40, textAlign: 'right' }}>
            {value}
          </Txt>
          <ChevronRight size={14} color={palette.textFaint} />
        </View>
      </Card>
    </PressableScale>
  );
}
