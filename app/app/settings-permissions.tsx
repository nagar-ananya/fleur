/**
 * Settings → Permissions. Location and health data, both optional — split
 * out of the old single-page Settings in the v2 redesign.
 */

import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HEALTH_ENABLED, REQUESTED_SCOPES } from '../src/api/health';
import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { spacing, radius } from '../src/theme';

export default function SettingsPermissionsScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { profile, db, setProfile } = useApp();
  const [locationGranted, setLocationGranted] = useState(false);

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then(({ status }) =>
      setLocationGranted(status === 'granted'),
    );
  }, []);

  const onRequestLocation = async (): Promise<void> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(status === 'granted');
    if (status === 'granted' && db && profile) {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const next = {
        ...profile,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setProfile(next);
    }
  };

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted">Both optional · the app works fully without either</Txt>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Location</Kicker>
      <Card>
        <Txt variant="label">
          {locationGranted ? (profile?.cityLabel ?? 'Approximate location') : 'Not granted'}
        </Txt>
        <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm, lineHeight: 18 }}>
          Rounded to two decimals — about a kilometre — before it is sent to Open-Meteo. Nothing
          else ever leaves the phone.
        </Txt>
        {!locationGranted ? (
          <Button label="Allow location" variant="secondary" onPress={() => void onRequestLocation()} style={{ marginTop: spacing.md }} />
        ) : null}
      </Card>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Fitbit (via Google Health)
      </Kicker>
      <Card style={{ borderRadius: radius.lg }}>
        <Txt variant="label">
          {HEALTH_ENABLED ? `Reading ${REQUESTED_SCOPES.join(', ')}` : 'Off in this build'}
        </Txt>
        <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm, lineHeight: 18 }}>
          {HEALTH_ENABLED
            ? 'Read once a day, trailing 14 days. Nothing is ever written back.'
            : 'Not yet integrated. Sleep, resting heart rate and steps are entered manually until this is on.'}
        </Txt>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {REQUESTED_SCOPES.map((scope) => (
            <View key={scope} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ width: 2, borderRadius: 1, backgroundColor: palette.primary }} />
              <Txt tone="muted" style={{ flex: 1, lineHeight: 19 }}>
                {scopeLabel(scope)}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <Card tone="alt" level={1} style={{ marginTop: spacing.xl }}>
        <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
          If Fitbit and your check-in both report sleep for the same date, the Fitbit value
          wins in the feature vector.
        </Txt>
      </Card>
    </Screen>
  );
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case 'sleep_analysis':
      return 'Sleep analysis — replaces the manual sleep slider when present.';
    case 'resting_heart_rate':
      return 'Resting heart rate — a rough proxy for physiological load.';
    case 'step_count':
      return 'Step count — nothing else is requested, ever.';
    default:
      return scope;
  }
}
