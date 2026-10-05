import React, { useEffect } from 'react';
import { Alert, Switch, View } from 'react-native';

import { SparkIcon } from '../src/components/icons';
import { Button, Card, IconBadge, Kicker, Pill, Screen, Txt } from '../src/components/primitives';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { bandStyle, spacing } from '../src/theme';

export default function SettingsAiScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { analysisMode, setAnalysisMode } = useApp();
  const example = bandStyle('elevated', palette);

  useEffect(() => {
    if (analysisMode !== 'local') void setAnalysisMode('local');
  }, [analysisMode, setAnalysisMode]);

  const onConnect = (): void => {
    Alert.alert('Coming soon', 'The TypeSafe connection is not built yet. This screen is a preview.');
  };

  return (
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: 100 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconBadge background={palette.primarySoft} size={48}>
          <SparkIcon size={22} color={palette.primary} />
        </IconBadge>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">TypeSafe</Txt>
          <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
            AI second opinion on your score
          </Txt>
        </View>
        <Pill label="Not connected" color={palette.textMuted} background={palette.surfaceAlt} />
      </Card>

      <Button label="Connect TypeSafe" onPress={onConnect} style={{ marginTop: spacing.lg }} />

      <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Txt variant="label">Daily second opinion</Txt>
          <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
            Connect TypeSafe first
          </Txt>
        </View>
        <Switch value={false} disabled />
      </Card>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>What you would see</Kicker>
      <Card tone="alt" style={{ borderStyle: 'dashed', borderWidth: 1.5, borderColor: palette.borderStrong }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Kicker>TypeSafe says</Kicker>
          <Txt variant="caption" tone="faint">
            Example
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
          <Pill label={example.label} color={example.text} background={example.soft} />
          <Txt tone="muted">Agrees with your score</Txt>
        </View>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 21 }}>
          Stress from last week and short sleep look like the main reasons today.
        </Txt>
      </Card>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>What would be shared</Kicker>
      <Txt tone="muted" style={{ lineHeight: 22 }}>
        Only your check-in numbers from the last two weeks. No name and no location. Your score on
        Today would still come from this phone, and the AI opinion would just show next to it.
      </Txt>
    </Screen>
  );
}
