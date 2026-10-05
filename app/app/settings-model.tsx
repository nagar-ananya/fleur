import React from 'react';
import { View } from 'react-native';

import { Card, Kicker, NumberCircle, Screen, Txt } from '../src/components/primitives';
import { DISCLAIMER_FULL } from '../src/constants/copy';
import { rulebook } from '../src/hooks/appState';
import { ruleNumber } from '../src/logic/rulebook';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';

export default function SettingsModelScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { bands } = rulebook;

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted" style={{ lineHeight: 22 }}>
        {`Fleur's score is a simple points system made for this project. Each of the ${rulebook.rules.length} rules can add up to a set number of points. Add them up and you get your score, from 0 to 100.`}
      </Txt>

      <Card style={{ marginTop: spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <Kicker>Rule</Kicker>
          <Kicker>Points</Kicker>
        </View>
        {rulebook.rules.map((rule) => (
          <View
            key={rule.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <NumberCircle value={ruleNumber(rule.id)} size={24} />
            <Txt style={{ flex: 1 }}>{rule.label}</Txt>
            <Txt variant="label" style={{ color: rule.points > 0 ? palette.bandHighText : palette.bandLowText }}>
              {rule.points > 0 ? `up to +${rule.points}` : `up to −${-rule.points}`}
            </Txt>
          </View>
        ))}
        <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 21 }}>
          {`Under ${bands.elevated} is Low, ${bands.elevated}-${bands.high - 1} is Elevated, ${bands.high} and up is High.`}
        </Txt>
      </Card>

      <Card tone="alt" level={1} style={{ marginTop: spacing.xl }}>
        <Kicker>Disclaimer</Kicker>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 21 }}>
          {DISCLAIMER_FULL}
        </Txt>
      </Card>
    </Screen>
  );
}
