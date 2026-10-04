/**
 * Daily check-in — one question per rule (REQUIREMENTS §11.3, FR-2.x).
 *
 * SPEC-DEVIATION: §11.3 asks for "a single vertically scrolling form". This
 * is a step-by-step flow instead, at the product owner's request: one screen
 * per question in `CHECKIN_QUESTIONS`, each tagged with the rule it feeds,
 * then a screen showing the rules the weather fills in, then the new score.
 * Every field still saves as exactly one row (FR-2.1). Fields no rule reads
 * (water, the other food tags, body areas, notes) are no longer asked, but
 * an existing day's values for them are kept untouched on save.
 *
 * Backfilling a past date has its own screen (`/backfill`) — this screen
 * edits either today or, when opened from History's "Edit this day", the
 * `date` param it was given.
 *
 * The final screen's score is a genuine preview: `withDraftCheckIn` splices
 * the draft into the same rows the scorer would see, and `deriveRiskState` —
 * the exact function `AppProvider.recompute` uses — scores it. Nothing is
 * written until Save is pressed.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArrowLeftIcon, CloseIcon } from '../src/components/icons';
import { NumberStepper, ScaleSlider, StepProgress, YesNo } from '../src/components/inputs';
import { PressableScale, Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Pill, Txt } from '../src/components/primitives';
import { CHECKIN_QUESTIONS, type CheckInQuestion } from '../src/constants/checkin';
import {
  getCheckIn,
  getEnvironmentDay,
  getPreviousCheckIn,
  getWearableDay,
  loadFeatureInputRows,
} from '../src/db/queries';
import { rulebook, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { deriveRiskState, withDraftCheckIn, type RiskState } from '../src/logic/risk';
import { ruleNumber, type Rule } from '../src/logic/rulebook';
import { bandStyle, radius, spacing } from '../src/theme';
import { emptyCheckIn, type CheckIn, type EnvironmentDay } from '../src/types/models';
import { isEditableDate, todayLocal } from '../src/utils/dates';

/** Rules nobody is asked about — filled in from the weather. */
const AUTO_RULES: readonly Rule[] = rulebook.rules.filter(
  (rule) => !CHECKIN_QUESTIONS.some((q) => q.rule === rule.id),
);

/** Where each weather rule's reading comes from, for the weather screen. */
const WEATHER_READINGS: Readonly<
  Record<string, { field: keyof EnvironmentDay; format: (v: number) => string }>
> = {
  pm2_5: { field: 'pm25', format: (v) => `PM2.5 ${Math.round(v)}` },
  temp_delta_1d: { field: 'tempMeanC', format: (v) => `${Math.round((v * 9) / 5 + 32)}°F today` },
  uv_index_max: { field: 'uvIndexMax', format: (v) => `UV ${v.toFixed(1)}` },
};

const WEATHER_STEP = CHECKIN_QUESTIONS.length;
const REVIEW_STEP = WEATHER_STEP + 1;
const STEP_COUNT = REVIEW_STEP + 1;

export default function CheckInScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { saveCheckIn, db } = useApp();
  const params = useLocalSearchParams<{ date?: string }>();

  const today = todayLocal();
  const date = params.date && isEditableDate(params.date) ? params.date : today;

  const [draft, setDraft] = useState<CheckIn>(() => emptyCheckIn(date));
  const [sleepFromDevice, setSleepFromDevice] = useState(false);
  const [conditions, setConditions] = useState<EnvironmentDay | null>(null);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      const [existing, device, env] = await Promise.all([
        getCheckIn(db, date),
        getWearableDay(db, date),
        getEnvironmentDay(db, date),
      ]);
      if (cancelled) return;
      setConditions(env);
      setSleepFromDevice(device?.sleepHours != null);

      if (existing) {
        setDraft(existing);
      } else {
        // FR-2.3: carry the sliders forward so most days are a confirmation.
        // Yes/no answers always start at No — they are about a specific day.
        const previous = await getPreviousCheckIn(db, date);
        if (cancelled) return;
        setDraft({
          ...emptyCheckIn(date),
          severity: previous?.severity ?? 0,
          itch: previous?.itch ?? null,
          stress: previous?.stress ?? null,
          sleepHours: device?.sleepHours ?? previous?.sleepHours ?? 8,
          alcoholUnits: 0,
        });
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [db, date]);

  const update = <K extends keyof CheckIn>(key: K, value: CheckIn[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const next = (): void => setStep((s) => Math.min(s + 1, REVIEW_STEP));

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

  const question = step < WEATHER_STEP ? CHECKIN_QUESTIONS[step] : null;
  const subtitle = question
    ? `Question ${step + 1} of ${CHECKIN_QUESTIONS.length}`
    : step === WEATHER_STEP
      ? 'Weather · filled in for you'
      : 'All done';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        }}
      >
        <PressableScale
          onPress={() => (step > 0 ? setStep(step - 1) : router.back())}
          accessibilityLabel={step > 0 ? 'Back' : 'Close'}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.surfaceAlt,
          }}
        >
          {step > 0 ? (
            <ArrowLeftIcon size={17} color={palette.textMuted} />
          ) : (
            <CloseIcon size={16} color={palette.textMuted} />
          )}
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">Check-in</Txt>
          <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <StepProgress total={STEP_COUNT} current={step} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {!loaded ? (
          <Txt tone="faint">Loading…</Txt>
        ) : question ? (
          <QuestionStep
            key={question.rule}
            question={question}
            draft={draft}
            sleepFromDevice={sleepFromDevice}
            onChange={(field, value) => {
              update(field, value as never);
              // A yes/no tap is the whole answer — move on by itself.
              if (question.kind === 'yesno') {
                if (advanceTimer.current) clearTimeout(advanceTimer.current);
                advanceTimer.current = setTimeout(next, 250);
              }
            }}
          />
        ) : step === WEATHER_STEP ? (
          <WeatherStep conditions={conditions} />
        ) : (
          <ReviewStep draft={draft} date={date} db={db} />
        )}
      </ScrollView>

      <View style={{ padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg }}>
        <Button
          label={step === REVIEW_STEP ? 'Save' : 'Next'}
          onPress={() => (step === REVIEW_STEP ? void onSave() : next())}
          disabled={saving || !loaded}
        />
      </View>
    </SafeAreaView>
  );
}

// --------------------------------------------------------------------------
// One question
// --------------------------------------------------------------------------

/** "Rule 3 · You were unwell a week or two ago" */
function RuleTag({ id }: { id: string }): React.ReactElement {
  const { palette } = useTheme();
  const rule = rulebook.rules.find((r) => r.id === id);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pill label={`RULE ${ruleNumber(id)}`} color={palette.primary} background={palette.primarySoft} />
      <Txt variant="caption" tone="faint" style={{ flex: 1 }} numberOfLines={1}>
        {rule?.label ?? ''}
      </Txt>
    </View>
  );
}

/** For rules that look back, say when today's answer starts to count. */
function lookbackNote(id: string): string | null {
  const from = rulebook.rules.find((r) => r.id === id)?.look_at.from ?? 0;
  return from > 0 ? `Today's answer counts toward your score in about ${from} days.` : null;
}

function QuestionStep({
  question,
  draft,
  sleepFromDevice,
  onChange,
}: {
  question: CheckInQuestion;
  draft: CheckIn;
  sleepFromDevice: boolean;
  onChange: (field: CheckInQuestion['field'], value: number | boolean) => void;
}): React.ReactElement {
  const note = lookbackNote(question.rule);

  return (
    <Reveal>
      <RuleTag id={question.rule} />
      <Txt variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
        {question.question}
      </Txt>

      {question.kind === 'scale' ? (
        <Card>
          <ScaleSlider
            label="0 to 10"
            value={draft[question.field]}
            onChange={(v) => onChange(question.field, v)}
            minAnchor={question.minLabel}
            maxAnchor={question.maxLabel}
          />
        </Card>
      ) : question.kind === 'count' ? (
        <NumberStepper
          value={draft[question.field]}
          onChange={(v) => onChange(question.field, v)}
          unit={question.unit}
          step={question.step}
          max={question.max}
        />
      ) : (
        <YesNo value={draft[question.field]} onChange={(v) => onChange(question.field, v)} />
      )}

      {question.field === 'sleepHours' && sleepFromDevice ? (
        <Txt variant="caption" tone="faint" center style={{ marginTop: spacing.lg }}>
          Filled in from your Fitbit.
        </Txt>
      ) : null}
      {note ? (
        <Txt variant="caption" tone="faint" center style={{ marginTop: spacing.lg }}>
          {note}
        </Txt>
      ) : null}
    </Reveal>
  );
}

// --------------------------------------------------------------------------
// Weather
// --------------------------------------------------------------------------

function WeatherStep({ conditions }: { conditions: EnvironmentDay | null }): React.ReactElement {
  const { palette } = useTheme();
  return (
    <Reveal>
      <Txt variant="title">{`The weather covers the last ${AUTO_RULES.length} rules`}</Txt>
      <Txt tone="muted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        Nothing to answer here — Fleur looks these up for your area.
      </Txt>
      <View style={{ gap: spacing.sm }}>
        {AUTO_RULES.map((rule) => {
          const source = WEATHER_READINGS[rule.look_at.column];
          const raw = source && conditions ? conditions[source.field] : null;
          const reading = typeof raw === 'number' ? source.format(raw) : 'Not available';
          return (
            <View
              key={rule.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: palette.surfaceAlt,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <Pill
                label={`RULE ${ruleNumber(rule.id)}`}
                color={palette.primary}
                background={palette.primarySoft}
              />
              <Txt style={{ flex: 1 }}>{rule.label}</Txt>
              <Txt variant="label" tone={typeof raw === 'number' ? 'default' : 'faint'}>
                {reading}
              </Txt>
            </View>
          );
        })}
      </View>
    </Reveal>
  );
}

// --------------------------------------------------------------------------
// New score
// --------------------------------------------------------------------------

function ReviewStep({
  draft,
  date,
  db,
}: {
  draft: CheckIn;
  date: string;
  db: ReturnType<typeof useApp>['db'];
}): React.ReactElement {
  const { risk: before } = useApp();
  const [after, setAfter] = useState<RiskState | null>(null);
  const draftSignature = JSON.stringify(draft);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    void loadFeatureInputRows(db, date)
      .then((rows) => {
        if (cancelled) return;
        setAfter(deriveRiskState(withDraftCheckIn(rows, { ...draft, date }), rulebook));
      })
      .catch((error: unknown) => {
        console.error('[fleur] could not compute check-in preview', error);
      });
    return () => {
      cancelled = true;
    };
    // The draft object is recreated on every change; its serialised form is
    // a cheap, stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, date, draftSignature]);

  return (
    <Reveal>
      <Txt variant="title">Your new score</Txt>
      <Txt tone="muted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        {`You answered ${CHECKIN_QUESTIONS.length} rules and the weather filled in ${AUTO_RULES.length}. Press Save to keep it.`}
      </Txt>
      <Card level={2}>
        <Outlook before={before} after={after} />
      </Card>
    </Reveal>
  );
}

function Outlook({ before, after }: { before: RiskState; after: RiskState | null }): React.ReactElement {
  const { palette } = useTheme();

  if (!after) {
    return <Txt tone="muted">Working it out…</Txt>;
  }
  if (after.status !== 'ready') {
    const remaining = after.status === 'collecting' ? Math.max(after.required - after.days, 0) : null;
    return (
      <Txt tone="muted" style={{ lineHeight: 22 }}>
        {remaining === 0
          ? 'This check-in unlocks your first score.'
          : remaining !== null
            ? `${remaining} more ${remaining === 1 ? 'day' : 'days'} of check-ins until your first score.`
            : 'Not enough of the last two weeks logged for a score yet.'}
      </Txt>
    );
  }

  const style = bandStyle(after.band, palette);
  const was = before.status === 'ready' ? before.score : null;
  const delta = was === null ? null : after.score - was;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Txt variant="hero" style={{ color: style.text }}>
          {after.score}
        </Txt>
        <Pill label={style.label} color={style.text} background={style.soft} />
      </View>
      <Txt tone="muted" style={{ marginTop: spacing.sm }}>
        {was === null || delta === null
          ? 'Your first score.'
          : delta === 0
            ? `Same as before (${was}).`
            : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} from ${was}.`}
      </Txt>
    </View>
  );
}
