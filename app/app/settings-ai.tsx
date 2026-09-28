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

import { Button, Card, Screen, Txt } from '../src/components/primitives';
import { ChevronRight } from '../src/components/icons';
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

  const [pendingAi, setPendingAi] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const aiChosen = analysisMode === 'local_plus_ai' || pendingAi;

  const onSaveKey = async (): Promise<void> => {
    if (!keyInput.trim()) return;
    setSaving(true);
    const ok = await saveApiKey(keyInput);
    setSaving(false);
    if (ok) {
      setHasKey(true);
      setKeyInput('');
      // Saving a key after picking the AI option is what turns it on.
      setPendingAi(false);
      await setAnalysisMode('local_plus_ai');
      await refreshAiOpinion(true);
    }
  };

  const onForgetKey = async (): Promise<void> => {
    await forgetApiKey();
    setHasKey(false);
    setPendingAi(false);
    await setAnalysisMode('local');
  };

  const onPickMode = async (mode: AnalysisMode): Promise<void> => {
    if (mode === 'local_plus_ai' && !hasKey) {
      // No key yet: show the key box right under the options first.
      setPendingAi(true);
      return;
    }
    setPendingAi(false);
    await setAnalysisMode(mode);
  };

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted" style={{ lineHeight: 22 }}>
        Your score is always worked out on this phone. You can also ask an AI for a second
        opinion on the same numbers.
      </Txt>

      <ModeRow
        selected={!aiChosen}
        title="On this phone"
        detail="Nothing leaves your phone. This is the default."
        onPress={() => void onPickMode('local')}
      />
      <ModeRow
        selected={aiChosen}
        title="On this phone + AI second opinion"
        detail="Sends your last two weeks of numbers to Anthropic once a day."
        disabled={!available}
        onPress={() => void onPickMode('local_plus_ai')}
      />

      {!available ? (
        <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 20 }}>
          Secure key storage is not available in this build, so the AI option is off. Everything
          else works without it.
        </Txt>
      ) : null}

      {aiChosen && available ? (
        <Card style={{ marginTop: spacing.md }}>
          <Txt variant="label">Your Anthropic API key</Txt>
          {hasKey ? (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Txt tone="accent">A key is saved on this phone.</Txt>
              <Button
                label={aiStatus === 'loading' ? 'Asking…' : 'Ask again now'}
                variant="secondary"
                onPress={() => void refreshAiOpinion(true)}
                disabled={aiStatus === 'loading'}
              />
              <Button label="Forget my key" variant="quiet" onPress={() => void onForgetKey()} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
                Get one from console.anthropic.com. It stays in this phone's keystore.
              </Txt>
              <TextInput
                value={keyInput}
                onChangeText={setKeyInput}
                placeholder="sk-ant-..."
                placeholderTextColor={palette.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
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
                label={saving ? 'Saving…' : 'Save key and turn on'}
                onPress={() => void onSaveKey()}
                disabled={!keyInput.trim() || saving}
              />
            </View>
          )}
        </Card>
      ) : null}

      {/* Everything technical, folded away until asked for. */}
      <PressableScale
        onPress={() => setShowDetails((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetails }}
        accessibilityLabel="How the AI option works"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.xl,
          paddingVertical: spacing.md,
        }}
      >
        <Txt variant="label" tone="accent">
          How the AI option works
        </Txt>
        <View style={{ transform: [{ rotate: showDetails ? '90deg' : '0deg' }] }}>
          <ChevronRight size={16} color={palette.primary} />
        </View>
      </PressableScale>

      {showDetails ? (
        <View style={{ gap: spacing.lg }}>
          <Detail title="Your score never changes">
            The AI never replaces the number on Today. It appears as a second card that agrees or
            disagrees. If it is unavailable — offline, no key, anything at all — your score is
            unaffected.
          </Detail>
          <Detail title="What gets sent">
            {`Fourteen rows of numbers, once a day, to ${AI_MODEL}. No name, no dates, no location and nothing from your profile. Fleur has no server of its own — your key is only ever sent to Anthropic.`}
          </Detail>
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: palette.surfaceAlt,
            }}
          >
            <Txt variant="micro" tone="faint" style={{ fontFamily: 'monospace', lineHeight: 15 }}>
              {sample ?? 'Log a few check-ins and your real numbers will appear here.'}
            </Txt>
          </View>
          <Detail title="Worth knowing">
            An AI answer can change if you ask twice. The points score is the same every time for
            the same answers, which is why it stays the number on Today. The AI has not been tested
            against the points score, so treat it as interesting, not authoritative.
          </Detail>
        </View>
      ) : null}
    </Screen>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View>
      <Txt variant="label">{title}</Txt>
      <Txt tone="muted" style={{ marginTop: spacing.xs, lineHeight: 21 }}>
        {children}
      </Txt>
    </View>
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
