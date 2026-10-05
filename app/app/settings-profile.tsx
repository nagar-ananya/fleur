import React from 'react';
import { View } from 'react-native';

import { ChoiceRow, ToggleRow } from '../src/components/inputs';
import { Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { saveProfile } from '../src/db/queries';
import { useApp } from '../src/hooks/appState';
import { spacing } from '../src/theme';
import {
  PSORIASIS_TYPES,
  PSORIASIS_TYPE_LABELS,
  type Profile,
  type PsoriasisType,
} from '../src/types/models';

export default function SettingsProfileScreen(): React.ReactElement {
  const { profile, db, setProfile } = useApp();

  const updateProfile = async (patch: Partial<Profile>): Promise<void> => {
    if (!db || !profile) return;
    const next = { ...profile, ...patch };
    await saveProfile(db, next);
    setProfile(next);
  };

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted">No name, email or account needed.</Txt>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Psoriasis type</Kicker>
      <ChoiceRow
        options={PSORIASIS_TYPES}
        value={profile?.psoriasisType ?? null}
        labels={PSORIASIS_TYPE_LABELS}
        onChange={(next: PsoriasisType) => void updateProfile({ psoriasisType: next })}
      />

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Year of onset</Kicker>
      <Txt tone="muted">
        {profile?.onsetYear ? `${profile.onsetYear} (roughly)` : 'Not set'}
      </Txt>

      <View style={{ marginTop: spacing.xl }}>
        <Card>
          <ToggleRow
            label="On a systemic or biologic treatment"
            hint="Just for your info. It doesn't change your score."
            value={profile?.onSystemic ?? false}
            onChange={(next) => void updateProfile({ onSystemic: next })}
          />
        </Card>
      </View>

      <Card tone="alt" level={1} style={{ marginTop: spacing.xl }}>
        <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
          Changing your profile does not change how your score is worked out.
        </Txt>
      </Card>
    </Screen>
  );
}
