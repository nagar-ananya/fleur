/**
 * Daily check-in (REQUIREMENTS §11.3, FR-2.x).
 *
 * SPEC-DEVIATION: §11.3 asks for "a single vertically scrolling form". This is
 * a four-step flow instead, at the product owner's request — one long form ran
 * well past the fold and read as a chore. The sections and their order are
 * unchanged (Skin → Body → Food → Events, notes last), so FR-2.1 still holds:
 * one check-in covering every field, saved as exactly one row.
 *
 * The acceptance criterion §11.3 attaches to that form — "a user who changes
 * only the severity slider can save in 2 taps total" — is preserved rather
 * than traded away: severity leads step 1 pre-filled from yesterday, and Save
 * stays live in the header on every step. Open → Save is still two taps.
 * Stepping through all four is the optional path, not the required one.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import {
  ChipToggle,
  ScaleSlider,
  SelectableCard,
  StepProgress,
} from '../src/components/inputs';
import { GradientFill } from '../src/components/gradient';
import { PressableScale } from '../src/components/motion';
import { Button, Card, Kicker, Txt } from '../src/components/primitives';
import { getCheckIn, getPreviousCheckIn } from '../src/db/queries';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, severityGradient, severityWord, spacing } from '../src/theme';
import { emptyCheckIn, type CheckIn } from '../src/types/models';
import { addDays, formatRelative, isEditableDate, todayLocal } from '../src/utils/dates';

const STEPS = [
  { key: 'skin', title: 'Your skin', blurb: 'The only part Fleur really needs.' },
  { key: 'body', title: 'Your body', blurb: 'Sleep, stress, and what you drank.' },
  { key: 'food', title: 'Food', blurb: 'Tap anything you ate today.' },
  {
    key: 'events',
    title: 'Anything happen?',
    blurb: 'Only if it applies — most days nothing will.',
  },
] as const;

const FOOD_FIELDS = [
  { key: 'dietDairy', label: 'Dairy' },
  { key: 'dietGluten', label: 'Gluten' },
  { key: 'dietProcessed', label: 'Processed food' },
  { key: 'dietSugar', label: 'Sugar' },
  { key: 'dietRedMeat', label: 'Red meat' },
] as const satisfies readonly { key: keyof CheckIn; label: string }[];

export default function CheckInScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { saveCheckIn, db } = useApp();
  const params = useLocalSearchParams<{ date?: string }>();

  const today = todayLocal();
  const [date, setDate] = useState<string>(
    params.date && isEditableDate(params.date) ? params.date : today,
  );
  const [draft, setDraft] = useState<CheckIn>(() => emptyCheckIn(date));
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const anim = useRef(new Animated.Value(1)).current;
  const direction = useRef(1);

  /** FR-2.4: back-fill is limited to the trailing 7 days. */
  const selectableDates = useMemo(
    () => Array.from({ length: 8 }, (_, i) => addDays(today, -i)),
    [today],
  );

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      const existing = await getCheckIn(db, date);
      if (cancelled) return;
      if (existing) {
        setDraft(existing);
      } else {
        // FR-2.3: carry slider values forward so most days are a confirmation.
        // Diet and event toggles always start off — those are assertions about
        // a specific day and must never be inherited.
        const previous = await getPreviousCheckIn(db, date);
        if (cancelled) return;
        setDraft({
          ...emptyCheckIn(date),
          severity: previous?.severity ?? 0,
          itch: previous?.itch ?? null,
          stress: previous?.stress ?? null,
          sleepHours: previous?.sleepHours ?? null,
          waterGlasses: previous?.waterGlasses ?? null,
          alcoholUnits: previous?.alcoholUnits ?? null,
        });
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, date]);

  const update = <K extends keyof CheckIn>(key: K, value: CheckIn[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const goTo = (next: number): void => {
    if (next < 0 || next >= STEPS.length) return;
    direction.current = next > step ? 1 : -1;
    Animated.timing(anim, {
      toValue: 0,
      duration: 110,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const onSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await saveCheckIn({ ...draft, date });
      router.back();
    } catch (error) {
      console.error('[fleur] could not save check-in', error);
      setSaving(false);
    }
  };

  const isLast = step === STEPS.length - 1;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [26 * direction.current, 0],
  });
  const severityRamp = severityGradient(draft.severity, palette);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <StepProgress total={STEPS.length} current={step} />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: spacing.md,
          }}
        >
          <Kicker>{`Step ${step + 1} of ${STEPS.length}`}</Kicker>
          {/* Live on every step, so severity-only remains a 2-tap save. */}
          <PressableScale
            onPress={() => void onSave()}
            disabled={saving || !loaded}
            accessibilityLabel="Save check-in"
            scaleTo={0.92}
            style={{
              minHeight: 40,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: palette.primarySoft,
            }}
          >
            <Txt variant="label" tone="accent">
              {saving ? 'Saving…' : 'Save'}
            </Txt>
          </PressableScale>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: anim, transform: [{ translateX }] }}>
          <Txt variant="title">{STEPS[step].title}</Txt>
          <Txt tone="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            {STEPS[step].blurb}
          </Txt>

          {!loaded ? (
            <Txt tone="faint">Loading…</Txt>
          ) : (
            <>
              {step === 0 ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
                  >
                    {selectableDates.map((candidate) => {
                      const selected = candidate === date;
                      return (
                        <PressableScale
                          key={candidate}
                          onPress={() => setDate(candidate)}
                          accessibilityLabel={formatRelative(candidate, today)}
                          accessibilityState={{ selected }}
                          scaleTo={0.94}
                          style={{
                            minHeight: 44,
                            justifyContent: 'center',
                            paddingHorizontal: spacing.lg,
                            borderRadius: radius.pill,
                            overflow: 'hidden',
                            backgroundColor: selected ? 'transparent' : palette.surface,
                            borderWidth: 1,
                            borderColor: selected ? 'transparent' : palette.border,
                          }}
                        >
                          {selected ? (
                            <GradientFill gradient={palette.gradients.primary} />
                          ) : null}
                          <Txt
                            variant="label"
                            style={{ color: selected ? palette.onAccent : palette.text }}
                          >
                            {formatRelative(candidate, today)}
                          </Txt>
                        </PressableScale>
                      );
                    })}
                  </ScrollView>

                  {/* The one required field, given the weight to match. */}
                  <Card level={2} style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                    <Kicker>Severity</Kicker>
                    <View
                      style={{
                        width: 132,
                        height: 132,
                        borderRadius: 66,
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginVertical: spacing.lg,
                      }}
                    >
                      <GradientFill gradient={severityRamp} />
                      <Txt variant="hero" tone="onAccent" style={{ fontSize: 58 }}>
                        {draft.severity}
                      </Txt>
                    </View>
                    <Txt variant="heading" tone="muted" style={{ marginBottom: spacing.lg }}>
                      {severityWord(draft.severity)}
                    </Txt>
                    <View style={{ width: '100%' }}>
                      <ScaleSlider
                        label="Drag to set"
                        value={draft.severity}
                        onChange={(v) => update('severity', v)}
                        minAnchor="none"
                        maxAnchor="worst ever"
                        gradient={severityRamp}
                        compact
                      />
                    </View>
                  </Card>

                  <Card style={{ marginTop: spacing.md, paddingBottom: spacing.xs }}>
                    <ScaleSlider
                      label="Itch"
                      value={draft.itch}
                      onChange={(v) => update('itch', v)}
                      minAnchor="none"
                      maxAnchor="unbearable"
                      compact
                    />
                  </Card>
                </>
              ) : null}

              {step === 1 ? (
                <Card style={{ paddingBottom: spacing.xs }}>
                  <ScaleSlider
                    label="Sleep"
                    value={draft.sleepHours}
                    onChange={(v) => update('sleepHours', v)}
                    min={0}
                    max={12}
                    step={0.5}
                    unit="h"
                    minAnchor="none"
                    maxAnchor="12+ hours"
                    gradient={palette.gradients.trend}
                  />
                  <ScaleSlider
                    label="Stress"
                    value={draft.stress}
                    onChange={(v) => update('stress', v)}
                    minAnchor="calm"
                    maxAnchor="overwhelmed"
                  />
                  <ScaleSlider
                    label="Water"
                    value={draft.waterGlasses}
                    onChange={(v) => update('waterGlasses', v)}
                    min={0}
                    max={15}
                    minAnchor="none"
                    maxAnchor="15+ glasses"
                    gradient={palette.gradients.low}
                  />
                  <ScaleSlider
                    label="Alcohol"
                    value={draft.alcoholUnits}
                    onChange={(v) => update('alcoholUnits', v)}
                    min={0}
                    max={12}
                    step={0.5}
                    minAnchor="none"
                    maxAnchor="12+ units"
                    gradient={palette.gradients.elevated}
                  />
                </Card>
              ) : null}

              {step === 2 ? (
                <>
                  {/* Two-column grid rather than a wrap of small pills: five
                      short labels left most of the screen empty, and bigger
                      targets are easier to hit one-handed. */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {FOOD_FIELDS.map(({ key, label }) => (
                      <ChipToggle
                        key={key}
                        label={label}
                        value={draft[key]}
                        onChange={(v) => update(key, v)}
                        style={{ flexGrow: 1, flexBasis: '45%', minHeight: 68 }}
                      />
                    ))}
                  </View>

                  <PressableScale
                    onPress={() => {
                      for (const { key } of FOOD_FIELDS) update(key, false);
                    }}
                    accessibilityLabel="None of these today"
                    style={{ minHeight: 44, justifyContent: 'center', marginTop: spacing.lg }}
                  >
                    <Txt variant="label" tone="accent" center>
                      None of these today
                    </Txt>
                  </PressableScale>

                  <Txt variant="caption" tone="faint" center style={{ marginTop: spacing.lg, lineHeight: 19 }}>
                    Logging food is optional. Fleur looks for patterns across weeks, so the odd
                    missed day changes very little.
                  </Txt>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <SelectableCard
                    label="Feeling unwell"
                    hint="Cold, fever, infection"
                    value={draft.illness}
                    onChange={(v) => update('illness', v)}
                  />
                  <SelectableCard
                    label="Sore throat"
                    hint="Tracked separately — a classic guttate trigger"
                    value={draft.soreThroat}
                    onChange={(v) => update('soreThroat', v)}
                  />
                  <SelectableCard
                    label="Skin injury"
                    hint="Cut, scratch, sunburn, friction"
                    value={draft.skinInjury}
                    onChange={(v) => update('skinInjury', v)}
                  />
                  <SelectableCard
                    label="New product"
                    hint="New soap, detergent, fragrance"
                    value={draft.newProduct}
                    onChange={(v) => update('newProduct', v)}
                  />
                  <SelectableCard
                    label="Took my treatment"
                    value={draft.medTaken}
                    onChange={(v) => update('medTaken', v)}
                  />

                  <Kicker style={{ marginTop: spacing.lg }}>Notes</Kicker>
                  <TextInput
                    value={draft.notes ?? ''}
                    onChangeText={(text) => update('notes', text.length ? text : null)}
                    placeholder="Anything else worth remembering?"
                    placeholderTextColor={palette.textFaint}
                    multiline
                    style={{
                      marginTop: spacing.sm,
                      minHeight: 96,
                      color: palette.text,
                      backgroundColor: palette.surfaceAlt,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: palette.border,
                      padding: spacing.md,
                      textAlignVertical: 'top',
                      fontSize: 16,
                    }}
                  />
                </>
              ) : null}
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          padding: spacing.lg,
          paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          backgroundColor: palette.surface,
        }}
      >
        {step > 0 ? (
          <Button
            label="Back"
            variant="secondary"
            onPress={() => goTo(step - 1)}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          label={isLast ? 'Save check-in' : 'Next'}
          onPress={() => (isLast ? void onSave() : goTo(step + 1))}
          disabled={saving || !loaded}
          style={{ flex: step > 0 ? 2 : 1 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
