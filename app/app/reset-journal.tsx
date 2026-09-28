/**
 * Reset → Mood → journal. Real, persisted, private text (never scored) — the
 * one Reset screen that writes actual rows, via `journal_entry` (schema v2).
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { JOURNAL_PROMPTS } from '../src/constants/reset';
import { listJournalEntries, saveJournalEntry } from '../src/db/queries';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';
import type { JournalEntry } from '../src/types/models';
import { formatLong, todayLocal } from '../src/utils/dates';

export default function JournalScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db } = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const promptKey = params.id ?? 'tonight';
  const prompt = JOURNAL_PROMPTS[promptKey] ?? JOURNAL_PROMPTS.tonight;

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const refresh = useCallback(() => {
    if (!db) return;
    void listJournalEntries(db).then(setEntries);
  }, [db]);

  useEffect(refresh, [refresh]);

  const onSave = async (): Promise<void> => {
    if (!db || draft.trim().length === 0) return;
    setSaving(true);
    try {
      await saveJournalEntry(db, todayLocal(), draft.trim());
      setDraft('');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: 'Journal' }} />
      <Reveal>
        <Txt variant="title">{formatLong(todayLocal())}</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          Mood · 2 min · private
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <Card level={2} style={{ marginTop: spacing.xl }}>
          <Txt variant="heading">{prompt}</Txt>
          <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
            Naming it is the point. The stress slider gives your score a number; this gives you
            the reason behind the number when you read it back in a few weeks.
          </Txt>
        </Card>
      </Reveal>

      <Reveal delay={110}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Start typing…"
          placeholderTextColor={palette.textFaint}
          multiline
          style={{
            marginTop: spacing.lg,
            minHeight: 120,
            backgroundColor: palette.surfaceAlt,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: palette.border,
            padding: spacing.md,
            color: palette.text,
            fontSize: 15,
            lineHeight: 22,
            textAlignVertical: 'top',
          }}
        />
        <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
          {`${draft.length} characters · stays on this device`}
        </Txt>
      </Reveal>

      <Button
        label={saving ? 'Saving…' : 'Save entry'}
        onPress={() => void onSave()}
        disabled={saving || draft.trim().length === 0}
        style={{ marginTop: spacing.lg }}
      />

      {entries.length > 0 ? (
        <Reveal delay={160}>
          <Kicker style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
            Earlier entries
          </Kicker>
          {entries.map((entry) => (
            <View key={entry.id} style={{ paddingVertical: spacing.sm }}>
              <Txt variant="caption" tone="faint">
                {formatLong(entry.date)}
              </Txt>
              <Txt tone="muted" style={{ marginTop: 3, lineHeight: 20 }} numberOfLines={3}>
                {entry.body}
              </Txt>
            </View>
          ))}
        </Reveal>
      ) : null}

      <Button
        label="Back to Mood"
        variant="secondary"
        onPress={() => router.back()}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
