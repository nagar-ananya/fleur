/**
 * Backfill a missed day — split out of the check-in flow in the v2 redesign
 * (REQUIREMENTS FR-2.4: any date in the last 7 days, one entry per date).
 *
 * Sliders start from the trailing week's mean rather than yesterday's value,
 * so a backfilled day cannot quietly inherit a number that was never true
 * for it — the exact reasoning the source design gives for this screen.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { CheckIcon } from '../src/components/icons';
import { ChipToggle, ScaleSlider } from '../src/components/inputs';
import { PressableScale, Reveal } from '../src/components/motion';
import { Button, Card, Kicker, Screen, Txt } from '../src/components/primitives';
import { getCheckIn, listCheckIns } from '../src/db/queries';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { radius, spacing } from '../src/theme';
import { emptyCheckIn, type CheckIn } from '../src/types/models';
import { addDays, dateRange, formatShort, todayLocal, weekdayInitial } from '../src/utils/dates';

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

const round1 = (n: number): number => Math.round(n * 10) / 10;

export default function BackfillScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { db, saveCheckIn } = useApp();
  const today = todayLocal();

  const days = useMemo(() => dateRange(addDays(today, -6), today), [today]);
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [weekMean, setWeekMean] = useState<{ severity: number; stress: number; sleepHours: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<CheckIn | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db) return;
    void listCheckIns(db, addDays(today, -6), today).then((rows) => {
      setLogged(new Set(rows.map((r) => r.date)));
      const withSeverity = rows.filter((r) => r.severity !== null);
      const withStress = rows.filter((r) => r.stress !== null);
      const withSleep = rows.filter((r) => r.sleepHours !== null);
      setWeekMean({
        severity: withSeverity.length ? round1(avg(withSeverity.map((r) => r.severity))) : 3,
        stress: withStress.length ? round1(avg(withStress.map((r) => r.stress ?? 0))) : 3,
        sleepHours: withSleep.length ? round1(avg(withSleep.map((r) => r.sleepHours ?? 0))) : 7,
      });
      // Default to the first empty day in the window, if any.
      const firstEmpty = days.find((d) => d !== today && !rows.some((r) => r.date === d));
      if (firstEmpty) setSelected(firstEmpty);
    });
  }, [db, today, days]);

  useEffect(() => {
    if (!db || !selected || !weekMean) return;
    void getCheckIn(db, selected).then((existing) => {
      setDraft(
        existing ?? {
          ...emptyCheckIn(selected),
          severity: Math.round(weekMean.severity),
          stress: Math.round(weekMean.stress),
          sleepHours: weekMean.sleepHours,
        },
      );
    });
  }, [db, selected, weekMean]);

  const update = <K extends keyof CheckIn>(key: K, value: CheckIn[K]): void => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const onSave = async (): Promise<void> => {
    if (!draft || !selected) return;
    setSaving(true);
    try {
      await saveCheckIn({ ...draft, date: selected });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const wasLogged = selected ? logged.has(selected) : false;

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Reveal>
        <Txt variant="title">Backfill a day</Txt>
        <Txt tone="muted" style={{ marginTop: spacing.xs }}>
          Any date in the last 7 days · one entry per date
        </Txt>
      </Reveal>

      <Reveal delay={60}>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg }}>
          {days.map((day) => {
            const isSelected = day === selected;
            const isToday = day === today;
            const isLogged = logged.has(day);
            return (
              <PressableScale
                key={day}
                onPress={() => !isToday && setSelected(day)}
                disabled={isToday}
                accessibilityLabel={formatShort(day)}
                scaleTo={0.95}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: isSelected ? palette.primary : palette.border,
                  backgroundColor: isSelected ? palette.primarySoft : 'transparent',
                  opacity: isToday ? 0.4 : 1,
                }}
              >
                <Txt variant="caption" tone="faint">
                  {weekdayInitial(day)}
                </Txt>
                <Txt variant="label" style={{ marginTop: spacing.xs, color: isSelected ? palette.primary : palette.text }}>
                  {day.slice(-2)}
                </Txt>
                {isLogged ? (
                  <CheckIcon size={11} color={palette.bandLowText} strokeWidth={2.6} />
                ) : (
                  <Txt variant="caption" tone="faint" style={{ fontSize: 9 }}>
                    {isToday ? 'today' : 'empty'}
                  </Txt>
                )}
              </PressableScale>
            );
          })}
        </View>
      </Reveal>

      {draft && selected ? (
        <Reveal delay={110}>
          <Kicker style={{ marginTop: spacing.xl }}>
            {`${formatShort(selected).toUpperCase()} · ${wasLogged ? 'EDITING' : 'EMPTY'}`}
          </Kicker>
          <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
            {wasLogged
              ? 'This day already has a check-in — saving overwrites it.'
              : "Sliders start at that week's average rather than yesterday's value, so a " +
                'backfilled day cannot quietly inherit the wrong number.'}
          </Txt>

          <Card style={{ marginTop: spacing.lg, paddingBottom: spacing.xs }}>
            <ScaleSlider
              label="Severity"
              value={draft.severity}
              onChange={(v) => update('severity', v)}
              minAnchor="clear"
              maxAnchor="worst ever"
            />
            <ScaleSlider
              label="Stress"
              value={draft.stress}
              onChange={(v) => update('stress', v)}
              minAnchor="calm"
              maxAnchor="overwhelmed"
            />
            <ScaleSlider
              label="Sleep"
              value={draft.sleepHours}
              onChange={(v) => update('sleepHours', v)}
              min={0}
              max={16}
              step={0.5}
              unit="h"
              minAnchor="none"
              maxAnchor="16 hours"
            />
          </Card>

          <Kicker style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Food & events</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {FOOD_FIELDS.map(({ key, label }) => (
              <ChipToggle key={key} label={label} value={draft[key]} onChange={(v) => update(key, v)} />
            ))}
            {EVENT_FIELDS.map(({ key, label }) => (
              <ChipToggle key={key} label={label} value={draft[key]} onChange={(v) => update(key, v)} />
            ))}
          </View>

          <Button
            label={`Save ${formatShort(selected)}`}
            onPress={() => void onSave()}
            disabled={saving}
            style={{ marginTop: spacing.xl }}
          />
          <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 18 }}>
            Saving a past date rebuilds every rule window that reaches it, then rescores today.
          </Txt>
        </Reveal>
      ) : null}
    </Screen>
  );
}

function avg(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0) / values.length;
}
