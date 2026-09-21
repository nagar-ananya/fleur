/**
 * Daily check-in — v2 redesign (REQUIREMENTS §11.3, FR-2.x).
 *
 * SPEC-DEVIATION: §11.3 asks for "a single vertically scrolling form". This
 * is a five-step flow instead, at the product owner's request, following the
 * new design exactly: Skin → Body & wearable → Food & events → Context →
 * Review & rescore. Every field still saves as exactly one row (FR-2.1);
 * what changed is the shape of the experience, not what is collected.
 *
 * Backfilling a past date now has its own screen (`/backfill`) rather than a
 * date-chip row on step 1 — this screen always edits either today or, when
 * opened from History's "Edit this day", the `date` param it was given.
 *
 * Step 5's "outlook after saving" is a genuine preview: `withDraftCheckIn`
 * splices the in-progress draft into the same rows the model would see, and
 * `deriveRiskState` — the exact function `AppProvider.recompute` uses —
 * scores it. Nothing is written until Save is actually pressed.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ArrowLeftIcon,
  CloseIcon,
  DropletIcon,
  HazeIcon,
  HeartIcon,
  LeafIcon,
  PulseIcon,
  SunIcon,
  ThermometerIcon,
  WatchIcon,
} from '../src/components/icons';
import { ChipToggle, ScaleSlider, StepProgress } from '../src/components/inputs';
import { PressableScale, Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Pill, Txt } from '../src/components/primitives';
import {
  getCheckIn,
  getEnvironmentDay,
  getPreviousCheckIn,
  getWearableDay,
  loadFeatureInputRows,
} from '../src/db/queries';
import { model, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { deriveRiskState, withDraftCheckIn, type RiskState } from '../src/ml/risk';
import { bandStyle, radius, spacing } from '../src/theme';
import {
  BODY_AREAS,
  BODY_AREA_LABELS,
  emptyCheckIn,
  type BodyArea,
  type CheckIn,
  type EnvironmentDay,
  type WearableDay,
  wearableSourceLabel,
} from '../src/types/models';
import { formatLong, isEditableDate, todayLocal } from '../src/utils/dates';
import { formatRelativeTime } from '../src/utils/relativeTime';

const STEPS = [
  { key: 'skin', label: 'SKIN', cta: 'Continue — body' },
  { key: 'body', label: 'BODY & WEARABLE', cta: 'Continue — day' },
  { key: 'food', label: 'FOOD & EVENTS', cta: 'Continue — context' },
  { key: 'context', label: 'CONTEXT', cta: 'Continue — review' },
  { key: 'review', label: 'REVIEW', cta: 'Save & rescore' },
] as const;

const STEP_FOOT = [
  'Severity alone is a valid check-in. Everything after this can be skipped.',
  'Fitbit data syncs on open. Fleur reads it; it never writes back.',
  'Untagged days are treated as missing, not as absence.',
  'Weather is cached hourly so this step works offline.',
  'Rescoring happens on device. Nothing leaves the phone.',
];

const FOOD_FIELDS = [
  { key: 'dietDairy', label: 'Dairy' },
  { key: 'dietGluten', label: 'Gluten' },
  { key: 'dietProcessed', label: 'Processed' },
  { key: 'dietSugar', label: 'Sugar' },
  { key: 'dietRedMeat', label: 'Red meat' },
] as const satisfies readonly { key: keyof CheckIn; label: string }[];

const EVENT_FIELDS = [
  { key: 'illness', label: 'Illness' },
  { key: 'soreThroat', label: 'Sore throat' },
  { key: 'skinInjury', label: 'Skin injury' },
  { key: 'newProduct', label: 'New product' },
  { key: 'medTaken', label: 'Medication taken' },
] as const satisfies readonly { key: keyof CheckIn; label: string }[];

export default function CheckInScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { saveCheckIn, db } = useApp();
  const params = useLocalSearchParams<{ date?: string }>();

  const today = todayLocal();
  const date = params.date && isEditableDate(params.date) ? params.date : today;

  const [draft, setDraft] = useState<CheckIn>(() => emptyCheckIn(date));
  const [previousAreas, setPreviousAreas] = useState<readonly BodyArea[]>([]);
  const [wearable, setWearable] = useState<WearableDay | null>(null);
  const [conditions, setConditions] = useState<EnvironmentDay | null>(null);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setWearable(device);
      setConditions(env);

      if (existing) {
        setDraft(existing);
      } else {
        // FR-2.3: carry slider values forward so most days are a confirmation.
        // Diet and event toggles always start off — those are assertions
        // about a specific day and must never be inherited.
        const previous = await getPreviousCheckIn(db, date);
        if (cancelled) return;
        setDraft({
          ...emptyCheckIn(date),
          severity: previous?.severity ?? 0,
          itch: previous?.itch ?? null,
          stress: previous?.stress ?? null,
          sleepHours: device?.sleepHours ?? previous?.sleepHours ?? null,
          waterGlasses: previous?.waterGlasses ?? null,
          alcoholUnits: previous?.alcoholUnits ?? null,
          areas: previous?.areas ?? [],
        });
        setPreviousAreas((previous?.areas ?? []) as BodyArea[]);
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

  const toggleArea = (area: BodyArea): void => {
    setDraft((current) => ({
      ...current,
      areas: current.areas.includes(area)
        ? current.areas.filter((a) => a !== area)
        : [...current.areas, area],
    }));
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
  const current = STEPS[step];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          <Kicker style={{ marginTop: 4 }}>{`STEP ${step + 1} OF ${STEPS.length} · ${current.label}`}</Kicker>
        </View>
        <Txt variant="caption" tone="faint" style={{ letterSpacing: 1 }}>
          {(formatLong(date).split(',')[0] ?? '').slice(0, 3).toUpperCase()}
        </Txt>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!loaded ? (
          <Txt tone="faint">Loading…</Txt>
        ) : (
          <>
            {step === 0 ? (
              <SkinStep
                draft={draft}
                update={update}
                previousAreas={previousAreas}
                toggleArea={toggleArea}
              />
            ) : null}
            {step === 1 ? <BodyStep draft={draft} update={update} wearable={wearable} /> : null}
            {step === 2 ? <FoodEventsStep draft={draft} update={update} /> : null}
            {step === 3 ? <ContextStep draft={draft} update={update} conditions={conditions} /> : null}
            {step === 4 ? (
              <ReviewStep
                draft={draft}
                date={date}
                db={db}
                wearable={wearable}
                conditions={conditions}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <StepProgress total={STEPS.length} current={step} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          padding: spacing.lg,
          paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
        }}
      >
        <Button
          label={isLast ? 'Save & rescore' : current.cta}
          onPress={() => (isLast ? void onSave() : setStep(step + 1))}
          disabled={saving || !loaded}
          style={{ flex: 1 }}
        />
      </View>
      <Txt variant="caption" tone="faint" center style={{ paddingBottom: spacing.md, lineHeight: 17 }}>
        {STEP_FOOT[step]}
      </Txt>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --------------------------------------------------------------------------
// Step 1 — Skin
// --------------------------------------------------------------------------

function SkinStep({
  draft,
  update,
  previousAreas,
  toggleArea,
}: {
  draft: CheckIn;
  update: <K extends keyof CheckIn>(key: K, value: CheckIn[K]) => void;
  previousAreas: readonly BodyArea[];
  toggleArea: (area: BodyArea) => void;
}): React.ReactElement {
  return (
    <Reveal>
      <Txt tone="muted" style={{ lineHeight: 20, marginBottom: spacing.lg }}>
        Two numbers. Everything else in this check-in is optional or filled in for you.
      </Txt>

      <Card style={{ paddingBottom: spacing.xs }}>
        <ScaleSlider
          label="Severity"
          value={draft.severity}
          onChange={(v) => update('severity', v)}
          minAnchor="clear"
          maxAnchor="worst ever"
        />
        <ScaleSlider
          label="Itch"
          value={draft.itch}
          onChange={(v) => update('itch', v)}
          minAnchor="none"
          maxAnchor="unbearable"
        />
      </Card>

      <Kicker style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Areas affected</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {BODY_AREAS.map((area) => (
          <ChipToggle
            key={area}
            label={BODY_AREA_LABELS[area]}
            value={draft.areas.includes(area)}
            onChange={() => toggleArea(area)}
          />
        ))}
      </View>
      {previousAreas.length > 0 ? (
        <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
          Carried over from yesterday. Tap to change.
        </Txt>
      ) : null}
    </Reveal>
  );
}

// --------------------------------------------------------------------------
// Step 2 — Body & wearable
// --------------------------------------------------------------------------

function BodyStep({
  draft,
  update,
  wearable,
}: {
  draft: CheckIn;
  update: <K extends keyof CheckIn>(key: K, value: CheckIn[K]) => void;
  wearable: WearableDay | null;
}): React.ReactElement {
  const { palette } = useTheme();
  const hasWearable =
    wearable !== null &&
    (wearable.restingHr !== null || wearable.hrv !== null || wearable.steps !== null);
  const sleepFromWearable = wearable?.sleepHours != null;

  return (
    <Reveal>
      {hasWearable && wearable ? (
        <Card
          level={2}
          style={{ marginBottom: spacing.lg, borderColor: palette.primary, borderWidth: 1 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <WatchIcon size={18} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Txt variant="label">{wearableSourceLabel(wearable.source)}</Txt>
              <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
                {`Synced ${formatRelativeTime(wearable.fetchedAt)}`}
              </Txt>
            </View>
            <Pill label="AUTO" color={palette.primary} background={palette.primarySoft} />
          </View>
          {/* Same three tiles as the source design: RESTING HR / HRV / STEPS.
              Sleep is not here — it already has its own slider below. */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <WearableTile
              icon={<HeartIcon size={16} color={palette.bandHighText} />}
              value={wearable.restingHr !== null ? `${Math.round(wearable.restingHr)}` : '—'}
              label="Resting HR"
            />
            <WearableTile
              icon={<PulseIcon size={16} color={palette.primary} />}
              value={wearable.hrv !== null ? `${Math.round(wearable.hrv)} ms` : '—'}
              label="HRV"
            />
            <WearableTile
              icon={<LeafIcon size={16} color={palette.aqua} />}
              value={wearable.steps !== null ? wearable.steps.toLocaleString() : '—'}
              label="Steps"
            />
          </View>
        </Card>
      ) : (
        <Card tone="alt" level={1} style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <WatchIcon size={18} color={palette.textFaint} />
          <Txt variant="caption" tone="faint" style={{ flex: 1, lineHeight: 18 }}>
            No Fitbit connected yet. Everything below is entered by hand.
          </Txt>
        </Card>
      )}

      <Card style={{ paddingBottom: spacing.xs }}>
        <ScaleSlider
          label={sleepFromWearable ? 'Sleep · from Fitbit' : 'Sleep'}
          value={draft.sleepHours}
          onChange={(v) => update('sleepHours', v)}
          min={0}
          max={16}
          step={0.5}
          unit="h"
          minAnchor="none"
          maxAnchor="16 hours"
        />
        <ScaleSlider
          label="Stress · your rating"
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
          unit=" glasses"
          minAnchor="none"
          maxAnchor="15+ glasses"
        />
        <ScaleSlider
          label="Alcohol"
          value={draft.alcoholUnits}
          onChange={(v) => update('alcoholUnits', v)}
          min={0}
          max={12}
          step={0.5}
          unit=" units"
          minAnchor="none"
          maxAnchor="12+ units"
        />
      </Card>

      {sleepFromWearable ? (
        <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 18 }}>
          Sleep was read from Fitbit. Drag it if the night was different from what it recorded
          — though the Fitbit reading is what the model actually uses (HD-5).
        </Txt>
      ) : null}
    </Reveal>
  );
}

function WearableTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}): React.ReactElement {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surfaceAlt,
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: 4,
      }}
    >
      {icon}
      <Txt variant="label" numberOfLines={1}>
        {value}
      </Txt>
      <Txt variant="caption" tone="faint" style={{ fontSize: 10 }} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

// --------------------------------------------------------------------------
// Step 3 — Food & events
// --------------------------------------------------------------------------

function FoodEventsStep({
  draft,
  update,
}: {
  draft: CheckIn;
  update: <K extends keyof CheckIn>(key: K, value: CheckIn[K]) => void;
}): React.ReactElement {
  return (
    <Reveal>
      <Kicker style={{ marginBottom: spacing.sm }}>Food · today</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {FOOD_FIELDS.map(({ key, label }) => (
          <ChipToggle key={key} label={label} value={draft[key]} onChange={(v) => update(key, v)} />
        ))}
      </View>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Events · today</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {EVENT_FIELDS.map(({ key, label }) => (
          <ChipToggle key={key} label={label} value={draft[key]} onChange={(v) => update(key, v)} />
        ))}
      </View>

      <Txt variant="caption" tone="faint" style={{ marginTop: spacing.xl, lineHeight: 19 }}>
        Tags are matched against your trigger profile at lags of 1 to 14 days. Nothing here is
        judged — alcohol and sugar are only signals.
      </Txt>
    </Reveal>
  );
}

// --------------------------------------------------------------------------
// Step 4 — Context
// --------------------------------------------------------------------------

function ContextStep({
  draft,
  update,
  conditions,
}: {
  draft: CheckIn;
  update: <K extends keyof CheckIn>(key: K, value: CheckIn[K]) => void;
  conditions: EnvironmentDay | null;
}): React.ReactElement {
  const { palette } = useTheme();
  const tiles: { key: string; icon: React.ReactNode; value: string; label: string }[] = [];
  if (conditions?.tempMeanC != null) {
    tiles.push({
      key: 'temp',
      icon: <ThermometerIcon size={16} color={palette.bandHighText} />,
      value: `${Math.round(conditions.tempMeanC)}°C`,
      label: 'Temp',
    });
  }
  if (conditions?.humidityMeanPct != null) {
    tiles.push({
      key: 'hum',
      icon: <DropletIcon size={16} color={palette.aqua} />,
      value: `${Math.round(conditions.humidityMeanPct)}%`,
      label: 'Humidity',
    });
  }
  if (conditions?.uvIndexMax != null) {
    tiles.push({
      key: 'uv',
      icon: <SunIcon size={16} color={palette.bandElevatedText} />,
      value: conditions.uvIndexMax.toFixed(1),
      label: 'UV',
    });
  }
  if (conditions?.pm25 != null) {
    tiles.push({
      key: 'pm',
      icon: <HazeIcon size={16} color={palette.textMuted} />,
      value: Math.round(conditions.pm25).toString(),
      label: 'PM2.5',
    });
  }

  return (
    <Reveal>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Kicker>Captured around you</Kicker>
        <Pill label="AUTO" color={palette.primary} background={palette.primarySoft} />
      </View>
      {tiles.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {tiles.map((tile) => (
            <View
              key={tile.key}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                backgroundColor: palette.surfaceAlt,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 5,
              }}
            >
              {tile.icon}
              <Txt variant="label">{tile.value}</Txt>
              <Txt variant="caption" tone="faint" style={{ fontSize: 10 }}>
                {tile.label}
              </Txt>
            </View>
          ))}
        </View>
      ) : (
        <Card tone="alt">
          <Txt tone="muted">No cached weather for this day yet.</Txt>
        </Card>
      )}
      <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 18 }}>
        Fetched from Open-Meteo for a rounded coordinate. You never type this in.
      </Txt>

      <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Anything else</Kicker>
      <TextInput
        value={draft.notes ?? ''}
        onChangeText={(text) => update('notes', text.length ? text : null)}
        placeholder="Anything else worth remembering?"
        placeholderTextColor={palette.textFaint}
        multiline
        style={{
          minHeight: 96,
          color: palette.text,
          backgroundColor: palette.surfaceAlt,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: palette.border,
          padding: spacing.md,
          textAlignVertical: 'top',
          fontSize: 15,
        }}
      />
      <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm, lineHeight: 18 }}>
        Notes are searchable in History. They are not fed to the model.
      </Txt>
    </Reveal>
  );
}

// --------------------------------------------------------------------------
// Step 5 — Review & rescore
// --------------------------------------------------------------------------

function countTruthy(...values: unknown[]): number {
  return values.filter((v) => v !== null && v !== undefined && v !== false && v !== '').length;
}

function ReviewStep({
  draft,
  date,
  db,
  wearable,
  conditions,
}: {
  draft: CheckIn;
  date: string;
  db: ReturnType<typeof useApp>['db'];
  wearable: WearableDay | null;
  conditions: EnvironmentDay | null;
}): React.ReactElement {
  const { palette } = useTheme();
  const { risk: currentRisk, checkinDays } = useApp();
  const [preview, setPreview] = useState<RiskState | null>(null);
  const draftSignature = JSON.stringify(draft);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    void loadFeatureInputRows(db, date)
      .then((rows) => {
        if (cancelled) return;
        const merged = withDraftCheckIn(rows, { ...draft, date });
        setPreview(deriveRiskState(merged, model));
      })
      .catch((error: unknown) => {
        // A silent failure here would look identical to "the outlook never
        // updates" — log loudly instead of leaving the last preview stuck.
        console.error('[fleur] could not compute check-in preview', error);
      });
    return () => {
      cancelled = true;
    };
    // Re-run whenever a value that affects scoring changes; the draft object
    // itself is recreated on every keystroke, so its serialised form is a
    // cheap, stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, date, draftSignature]);

  const youCount =
    countTruthy(
      draft.severity,
      draft.itch,
      draft.stress,
      draft.sleepHours,
      draft.waterGlasses,
      draft.alcoholUnits,
      draft.dietDairy,
      draft.dietGluten,
      draft.dietProcessed,
      draft.dietSugar,
      draft.dietRedMeat,
      draft.illness,
      draft.soreThroat,
      draft.skinInjury,
      draft.newProduct,
      draft.medTaken,
    ) + (draft.areas.length > 0 ? 1 : 0);

  const wearableCount = wearable
    ? countTruthy(wearable.sleepHours, wearable.restingHr, wearable.steps)
    : 0;
  const envCount = conditions
    ? countTruthy(
        conditions.tempMeanC,
        conditions.humidityMeanPct,
        conditions.uvIndexMax,
        conditions.pm25,
        conditions.pollenTotal,
      )
    : 0;

  const sources = [
    {
      icon: '✍️',
      title: 'Logged by you',
      subtitle: 'Severity, itch, stress and whatever else you set',
      n: youCount,
    },
    ...(wearableCount > 0
      ? [
          {
            icon: '⌚',
            title: wearable ? wearableSourceLabel(wearable.source) : 'Fitbit',
            subtitle: 'Sleep, resting heart rate, steps',
            n: wearableCount,
          },
        ]
      : []),
    ...(envCount > 0
      ? [{ icon: '☁️', title: 'Open-Meteo', subtitle: 'Temperature, humidity, air quality, UV', n: envCount }]
      : []),
    { icon: '🕓', title: 'Your history', subtitle: 'Lag windows across your logged days', n: checkinDays },
  ];

  return (
    <Reveal>
      <Txt tone="muted" style={{ lineHeight: 20, marginBottom: spacing.lg }}>
        Saving recomputes every lagged feature across your last two weeks — about a second on
        device.
      </Txt>

      {sources.map((source) => (
        <View
          key={source.title}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            backgroundColor: palette.surfaceAlt,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
          }}
        >
          <Txt style={{ fontSize: 18 }}>{source.icon}</Txt>
          <View style={{ flex: 1 }}>
            <Txt variant="label">{source.title}</Txt>
            <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
              {source.subtitle}
            </Txt>
          </View>
          <Txt variant="label" tone="accent">
            {source.n}
          </Txt>
        </View>
      ))}

      <Card level={2} style={{ marginTop: spacing.lg, borderColor: palette.primary, borderWidth: 1 }}>
        <Kicker>Outlook after saving</Kicker>
        <Outlook before={currentRisk} after={preview} />
      </Card>
    </Reveal>
  );
}

function Outlook({
  before,
  after,
}: {
  before: RiskState;
  after: RiskState | null;
}): React.ReactElement {
  const { palette } = useTheme();

  if (!after) {
    return (
      <Txt tone="muted" style={{ marginTop: spacing.sm }}>
        Computing…
      </Txt>
    );
  }
  if (after.status !== 'ready') {
    const remaining = after.status === 'collecting' ? Math.max(after.required - after.days, 0) : null;
    return (
      <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
        {remaining === 0
          ? 'This save unlocks your first forecast.'
          : remaining !== null
            ? `${remaining} more ${remaining === 1 ? 'day' : 'days'} until a forecast appears.`
            : 'Still not enough of the last two weeks logged for a forecast.'}
      </Txt>
    );
  }

  const style = bandStyle(after.band, palette);
  const beforePct = before.status === 'ready' ? Math.round(before.probability * 100) : null;
  const afterPct = Math.round(after.probability * 100);
  const delta = beforePct === null ? null : afterPct - beforePct;

  return (
    <View style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
        {beforePct !== null ? (
          <Txt variant="heading" tone="faint" style={{ textDecorationLine: 'line-through' }}>
            {`${beforePct}%`}
          </Txt>
        ) : null}
        <Txt variant="display" style={{ color: style.text }}>{`${afterPct}%`}</Txt>
        <Pill label={style.label} color={style.text} background={style.soft} />
      </View>
      <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
        {beforePct === null || delta === null
          ? 'Your first forecast with this check-in included.'
          : delta === 0
            ? `Unchanged from ${beforePct}% before this check-in.`
            : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'} from ${beforePct}% before this check-in.`}
      </Txt>
    </View>
  );
}
