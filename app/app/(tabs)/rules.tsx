/**
 * Rules — what Fleur checks (REQUIREMENTS §11.4, FR-5.x).
 *
 * The rulebook itself, not today's numbers: all 12 rules in fixed order
 * (`ruleNumber`), each with the most it can add.
 * Tapping a rule opens `/factor-detail`, which charts that rule's last two
 * weeks. Today's points live on `/risk-detail`, so the two screens never
 * show the same thing.
 *
 * §13.4 rules out calling anything "your #1 trigger".
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ChevronRight } from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import { Card, Kicker, Screen, ShortDisclaimer, Txt } from '../../src/components/primitives';
import { rulebook } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { ruleNumber, type Rule } from '../../src/logic/rulebook';
import { spacing } from '../../src/theme';

export default function RulesScreen(): React.ReactElement {
  const router = useRouter();
  const open = (rule: Rule): void =>
    router.push({ pathname: '/factor-detail', params: { ruleId: rule.id, label: rule.label } });

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>How Fleur works</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          {`The ${rulebook.rules.length} rules`}
        </Txt>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          Each rule watches one thing and can add up to a set number of points. Tap a rule to see
          its last two weeks.
        </Txt>
      </Reveal>

      <Reveal delay={60}>
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          {rulebook.rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onPress={() => open(rule)} />
          ))}
        </View>
      </Reveal>

      <ShortDisclaimer />
    </Screen>
  );
}

function RuleCard({ rule, onPress }: { rule: Rule; onPress: () => void }): React.ReactElement {
  const { palette } = useTheme();
  const adds = rule.points > 0;
  const max = adds ? `+${rule.points}` : `−${-rule.points}`;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Rule ${ruleNumber(rule.id)}: ${rule.label}, ${adds ? 'adds' : 'takes off'} up to ${Math.abs(rule.points)} points`}
      scaleTo={0.98}
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.surfaceAlt,
          }}
        >
          <Txt variant="label" tone="muted">
            {ruleNumber(rule.id)}
          </Txt>
        </View>
        <Txt style={{ flex: 1, lineHeight: 21 }}>{rule.label}</Txt>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="caption" tone="faint">
            up to
          </Txt>
          <Txt variant="heading" style={{ color: adds ? palette.bandHighText : palette.bandLowText }}>
            {max}
          </Txt>
        </View>
        <ChevronRight size={14} color={palette.textFaint} />
      </Card>
    </PressableScale>
  );
}
