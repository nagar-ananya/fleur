/**
 * Onboarding (REQUIREMENTS §3 F1, FR-1.x).
 *
 * Three steps, targeted at under 90 seconds (FR-1.5): disclaimer, profile,
 * location. The disclaimer requires an explicit tap (FR-1.1); every permission
 * can be declined and the app still works fully (FR-1.3, FR-1.4).
 */

import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { ChoiceRow, StepProgress, ToggleRow } from '../../src/components/inputs';
import { CheckIcon, PinIcon, ShieldIcon, SparkIcon } from '../../src/components/icons';
import { Reveal } from '../../src/components/motion';
import {
  Button,
  Card,
  IconBadge,
  Kicker,
  Screen,
  Txt,
} from '../../src/components/primitives';
import { HEALTH_ENABLED } from '../../src/api/health';
import { DISCLAIMER_FULL } from '../../src/constants/copy';
import { saveProfile } from '../../src/db/queries';
import { useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { radius, spacing } from '../../src/theme';
import {
  PSORIASIS_TYPES,
  PSORIASIS_TYPE_LABELS,
  type Profile,
  type PsoriasisType,
} from '../../src/types/models';

type Step = 'disclaimer' | 'profile' | 'location';
const ORDER: Step[] = ['disclaimer', 'profile', 'location'];

export default function OnboardingScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db, setProfile, refresh } = useApp();

  const [step, setStep] = useState<Step>('disclaimer');
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [psoriasisType, setPsoriasisType] = useState<PsoriasisType>('plaque');
  const [onsetYear, setOnsetYear] = useState('');
  const [onSystemic, setOnSystemic] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cityLabel, setCityLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const requestLocation = async (): Promise<void> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error) {
      console.warn('[fleur] location request failed', error);
    }
  };

  const finish = async (): Promise<void> => {
    if (!db || !acknowledgedAt) return;
    setSaving(true);
    const parsedYear = Number.parseInt(onsetYear, 10);
    const profile: Profile = {
      psoriasisType,
      onsetYear: Number.isFinite(parsedYear) ? parsedYear : null,
      onSystemic,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      cityLabel: cityLabel.trim() || null,
      disclaimerAckAt: acknowledgedAt,
      createdAt: new Date().toISOString(),
    };
    try {
      await saveProfile(db, profile);
      setProfile(profile);
      await refresh();
      router.replace('/');
    } catch (error) {
      console.error('[fleur] could not save profile', error);
      setSaving(false);
    }
  };

  const index = ORDER.indexOf(step);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ marginBottom: spacing.xl }}>
        <StepProgress total={ORDER.length} current={index} />
        <Kicker style={{ marginTop: spacing.md }}>{`Step ${index + 1} of ${ORDER.length}`}</Kicker>
      </View>

      {step === 'disclaimer' ? (
        <Reveal>
          <IconBadge background={palette.primarySoft} size={54}>
            <SparkIcon size={26} color={palette.primary} />
          </IconBadge>

          <Txt variant="hero" style={{ marginTop: spacing.lg }}>
            Fleur
          </Txt>
          <Txt variant="heading" tone="muted" style={{ marginTop: spacing.sm, lineHeight: 26 }}>
            Existing psoriasis apps are diaries. Fleur is a forecast.
          </Txt>

          <Card tone="alt" style={{ marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconBadge background={palette.surface} size={34}>
                <ShieldIcon size={18} color={palette.textMuted} />
              </IconBadge>
              <Txt variant="label">Please read this first</Txt>
            </View>
            <Txt tone="muted" style={{ marginTop: spacing.md, lineHeight: 23 }}>
              {DISCLAIMER_FULL}
            </Txt>
          </Card>

          {/* FR-1.1: an explicit acceptance control, not a passive scroll. */}
          <Button
            label="I understand and accept"
            icon={<CheckIcon size={18} color={palette.onAccent} />}
            onPress={() => {
              setAcknowledgedAt(new Date().toISOString());
              setStep('profile');
            }}
            style={{ marginTop: spacing.xl }}
          />
        </Reveal>
      ) : null}

      {step === 'profile' ? (
        <Reveal>
          <Txt variant="title">A little about you</Txt>
          <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
            This puts your check-ins in context. None of it leaves your phone.
          </Txt>

          <Kicker style={{ marginTop: spacing.xl }}>Type of psoriasis</Kicker>
          <View style={{ marginTop: spacing.md }}>
            <ChoiceRow
              options={PSORIASIS_TYPES}
              value={psoriasisType}
              labels={PSORIASIS_TYPE_LABELS}
              onChange={setPsoriasisType}
            />
          </View>

          <Kicker style={{ marginTop: spacing.xl }}>Roughly when did it start?</Kicker>
          <TextInput
            value={onsetYear}
            onChangeText={setOnsetYear}
            placeholder="e.g. 2015"
            placeholderTextColor={palette.textFaint}
            keyboardType="number-pad"
            maxLength={4}
            style={{
              marginTop: spacing.md,
              minHeight: 50,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.border,
              color: palette.text,
              fontSize: 16,
            }}
          />

          <Card style={{ marginTop: spacing.xl }}>
            <ToggleRow
              label="I'm on a systemic or biologic treatment"
              value={onSystemic}
              onChange={setOnSystemic}
            />
          </Card>

          <Button
            label="Continue"
            onPress={() => setStep('location')}
            style={{ marginTop: spacing.xl }}
          />
        </Reveal>
      ) : null}

      {step === 'location' ? (
        <Reveal>
          <IconBadge background={palette.aquaSoft} size={54}>
            <PinIcon size={26} color={palette.aqua} />
          </IconBadge>

          <Txt variant="title" style={{ marginTop: spacing.lg }}>
            Local conditions
          </Txt>
          <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 23 }}>
            Temperature swings, humidity, pollen and air quality are all candidate triggers.
            Fleur fetches them from a free public weather service using coordinates rounded to
            about a kilometre. Nothing else is ever sent.
          </Txt>

          <Button
            label={coords ? 'Location set' : 'Use my location'}
            variant={coords ? 'secondary' : 'primary'}
            icon={
              coords ? (
                <CheckIcon size={18} color={palette.bandLowText} />
              ) : (
                <PinIcon size={18} color={palette.onAccent} />
              )
            }
            onPress={() => void requestLocation()}
            style={{ marginTop: spacing.xl }}
          />

          {/* FR-1.3: degrade gracefully to a manually entered city. */}
          <Kicker style={{ marginTop: spacing.xl }}>Or enter a city</Kicker>
          <TextInput
            value={cityLabel}
            onChangeText={setCityLabel}
            placeholder="e.g. Manchester"
            placeholderTextColor={palette.textFaint}
            style={{
              marginTop: spacing.md,
              minHeight: 50,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.border,
              color: palette.text,
              fontSize: 16,
            }}
          />

          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.lg, lineHeight: 19 }}>
            {HEALTH_ENABLED
              ? 'Fleur can also read sleep and resting heart rate from your health app.'
              : 'Sleep is entered manually on the check-in form. Health-app syncing is off in this build.'}
          </Txt>

          <Button
            label="Finish setup"
            onPress={() => void finish()}
            disabled={saving}
            style={{ marginTop: spacing.xl }}
          />
          <Button
            label="Skip for now"
            variant="quiet"
            onPress={() => void finish()}
            disabled={saving}
            style={{ marginTop: spacing.sm }}
          />
        </Reveal>
      ) : null}
    </Screen>
  );
}
