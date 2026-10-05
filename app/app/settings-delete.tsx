import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { TrashIcon } from '../src/components/icons';
import { Button, Screen, Txt } from '../src/components/primitives';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';

const CONFIRM_PHRASE = 'DELETE';

const WIPE_ROWS = [
  'All your check-ins and notes',
  'Saved weather and air quality data',
  'All your past scores',
  'Your profile and Reset progress',
];

export default function SettingsDeleteScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { deleteAllData, refresh } = useApp();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const ready = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  const onDelete = async (): Promise<void> => {
    if (!ready) return;
    setDeleting(true);
    try {
      await deleteAllData();
      await refresh();
      router.back();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted" style={{ lineHeight: 21 }}>
        This deletes everything Fleur has saved on this phone and takes you back to the start.
        There is no backup, so it can't be undone.
      </Txt>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        {WIPE_ROWS.map((row) => (
          <View
            key={row}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: palette.surfaceAlt,
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <TrashIcon size={17} color={palette.textMuted} />
            <Txt tone="muted" style={{ flex: 1, lineHeight: 19 }}>
              {row}
            </Txt>
          </View>
        ))}
      </View>

      <Txt variant="micro" tone="faint" style={{ marginTop: spacing.xl, textTransform: 'uppercase' }}>
        {`Type ${CONFIRM_PHRASE} to confirm`}
      </Txt>
      <TextInput
        value={confirmText}
        onChangeText={setConfirmText}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRM_PHRASE}
        placeholderTextColor={palette.textFaint}
        style={{
          marginTop: spacing.sm,
          minHeight: 50,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          backgroundColor: palette.surfaceAlt,
          color: palette.text,
          fontSize: 16,
          letterSpacing: 1,
          borderWidth: 1,
          borderColor: ready ? palette.primary : palette.border,
        }}
      />

      <Button
        label={deleting ? 'Deleting…' : 'Delete everything'}
        variant="destructive"
        onPress={() => void onDelete()}
        disabled={!ready || deleting}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
