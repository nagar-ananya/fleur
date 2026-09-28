/**
 * Settings → AI second opinion.
 *
 * The only feature in Fleur that sends anything anywhere. It is off by default
 * and needs an explicit acceptance tap, mirroring the onboarding disclaimer —
 * because turning it on genuinely changes the app's privacy story, and the
 * person deserves to see exactly what leaves the phone before it does.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { PressableScale } from '../src/components/motion';
import { buildPayload } from '../src/ai/payload';
import { forgetApiKey, getApiKey, saveApiKey, secureStoreAvailable } from '../src/ai/keyStore';
import { AI_MODEL } from '../src/ai/secondOpinion';
import { loadFeatureInputRows } from '../src/db/queries';
import { buildDailyFrame } from '../src/logic/frame';
import { useApp, type AnalysisMode } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';
import { todayLocal } from '../src/utils/dates';

export default function SettingsAiScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { db, analysisMode, setAnalysisMode, aiStatus, refreshAiOpinion } = useApp();

  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [sample, setSample] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const available = useMemo(() => secureStoreAvailable(), []);

  useEffect(() => {
    void getApiKey().then((key) => setHasKey(key !== null));
  }, []);

  // Show the real payload, built from this person's own last 14 days.
  useEffect(() => {
    if (!db) return;
    void loadFeatureInputRows(db, todayLocal()).then((rows) => {
      const frame = buildDailyFrame(rows);
      if (frame.dates.length === 0) {
        setSample(null);
        return;
      }
      const payload = buildPayload(frame, frame.dates.length - 1);
      setSample(payload.map((row) => JSON.stringify(row)).join('\n'));
    });
  }, [db]);

  const onSaveKey = async (): Promise<void> => {
    if (!keyInput.trim()) return;
    setSaving(true);
    const ok = await saveApiKey(keyInput);
    setSaving(false);
    if (ok) {
      setHasKey(true);
      setKeyInput('');
      if (analysisMode === 'local_plus_ai') await refreshAiOpinion(true);
    }
  };

  const onForgetKey = async (): Promise<void> => {
    await forgetApiKey();
    setHasKey(false);
    await setAnalysisMode('local');
  };

  const onPickMode = async (mode: AnalysisMode): Promise<void> => {
    await setAnalysisMode(mode);
  };

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted" style={{ lineHeight: 22 }}>
        Fleur works out your score on this phone. You can also ask an AI for a
        second opinion on the same two weeks of numbers.
      </Txt>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        Your score always comes from this phone
      </Kicker>
      <Card tone="alt" level={1}>
        <Txt tone="muted" style={{ lineHeight: 22 }}>
          The AI never replaces the number on Today. It appears as a second card
          that either agrees or disagrees. If it is unavailable — offline, no key,
          anything at all — your score is unaffected, because it was never waiting
          on the network.
        </Txt>
      </Card>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Mode</Kicker>
      <ModeRow
        selected={analysisMode === 'local'}
        title="On this phone"
        detail="Nothing leaves your device. This is the default."
        onPress={() => void onPickMode('local')}
      />
      <ModeRow
        selected={analysisMode === 'local_plus_ai'}
        title="On this phone + AI second opinion"
        detail={`Sends the numbers below to Anthropic once a day, and asks ${AI_MODEL}.`}
        disabled={!hasKey || !available}
        onPress={() => void onPickMode('local_plus_ai')}
      />

      {!available ? (
        <Card tone="alt" level={1} style={{ marginTop: spacing.md }}>
          <Txt variant="caption" tone="muted" style={{ lineHeight: 20 }}>
            Secure key storage is not available in this build. Rebuild the app
            (`npx expo run:android`) to use the AI second opinion — everything else
            works without it.
          </Txt>
        </Card>
      ) : null}

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        Exactly what gets sent
      </Kicker>
      <Card>
        <Txt tone="muted" style={{ lineHeight: 22 }}>
          Fourteen rows of numbers. No name, no dates, no location, no notes, and
          nothing from your profile. Days are counted back from today.
        </Txt>
        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: palette.surfaceAlt,
          }}
        >
          <Txt variant="micro" tone="faint" style={{ fontFamily: 'monospace', lineHeight: 15 }}>
            {sample ?? 'Log a few check-ins and your real payload will appear here.'}
          </Txt>
        </View>
      </Card>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Your API key</Kicker>
      <Card>
        <Txt tone="muted" style={{ lineHeight: 22 }}>
          Fleur has no key of its own and no server. Use your own from
          console.anthropic.com. It is stored in this phone's keystore and is only
          ever sent to Anthropic.
        </Txt>

        {hasKey ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <Txt variant="label" tone="accent">A key is saved on this phone.</Txt>
            <Button label="Forget my key" variant="secondary" onPress={() => void onForgetKey()} />
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <TextInput
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="sk-ant-..."
              placeholderTextColor={palette.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              editable={available}
              style={{
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                color: palette.text,
                backgroundColor: palette.surfaceAlt,
              }}
            />
            <Button
              label={saving ? 'Saving…' : 'Save key'}
              onPress={() => void onSaveKey()}
              disabled={!available || !keyInput.trim() || saving}
            />
          </View>
        )}
      </Card>

      {analysisMode === 'local_plus_ai' ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={aiStatus === 'loading' ? 'Asking…' : 'Ask again now'}
            variant="secondary"
            onPress={() => void refreshAiOpinion(true)}
            disabled={aiStatus === 'loading'}
          />
        </View>
      ) : null}

      <Card tone="alt" level={1} style={{ marginTop: spacing.xl }}>
        <Kicker>Worth knowing</Kicker>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 21 }}>
          An AI answer is not reproducible — ask twice and it can differ. The
          points score is the same every time for the same input, which is why it
          stays the number on Today. The AI has also not been measured against the
          points system on test data, so treat it as interesting, not authoritative.
        </Txt>
      </Card>
    </Screen>
  );
}

function ModeRow({
  selected,
  title,
  detail,
  disabled = false,
  onPress,
}: {
  selected: boolean;
  title: string;
  detail: string;
  disabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { palette } = useTheme();
  const body = (
    <Card
      style={{
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: selected ? palette.primary : palette.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: selected ? palette.primary : palette.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary }}
            />
          ) : null}
        </View>
        <Txt variant="label" style={{ flex: 1 }}>
          {title}
        </Txt>
      </View>
      <Txt variant="caption" tone="muted" style={{ marginTop: spacing.sm, lineHeight: 19 }}>
        {detail}
      </Txt>
    </Card>
  );

  if (disabled) return body;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      scaleTo={0.99}
    >
      {body}
    </PressableScale>
  );
}
