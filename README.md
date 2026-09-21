# Fleur — Personal Flare Predictor & Trigger Tracker

> Existing psoriasis apps are diaries. Fleur is a forecast.

A two-part monorepo: an offline Python pipeline that trains an L1 logistic
regression on synthetic patients and exports it as a static JSON file, and an
Expo app that bundles that file and does inference on-device in TypeScript.

**No backend, no accounts, no cloud database.** All storage is local SQLite. The
only outbound request in the product goes to Open-Meteo, carrying nothing but
rounded coordinates.

Built against [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md).
Section references throughout the code (`§7.3`, `FR-4.2`, `SIM-6`) point back to it.

---

## Status

| Milestone | State | Evidence |
|---|---|---|
| M1 — Simulator | ✅ | 39,400 rows, 9.01% flare rate, 20.9% idiopathic, deterministic under seed |
| M2 — Model | ⚠️ **partial** | AP 0.327 (4.0× base rate); precision and VAL-2 short — see below |
| M3 — Export | ✅ | `model.json` validates; all 95 features labelled; **parity test passes** |
| M4 — App shell | ✅ | Bundles; SQLite migrates (schema v2); 5 tabs; onboarding completable |
| M5 — Check-in | ✅ | Save/read/backfill/edit all covered by tests; backfill is now its own screen |
| M6 — Integrations | ✅ | Open-Meteo cached and offline-readable; health behind flag, **off** (§10.2) |
| M7 — Risk & Insights | ✅ | Live risk on Today; Insights chart; disclaimers on every risk screen |
| **UI pass** | ✅ | Full visual redesign, verified on a Pixel 7 in light and dark |
| **v2 redesign** | ✅ | Reset tab, 5-step check-in, dedicated factor/backfill screens, real elimination test |
| M8 — Pilot | ⬜ | Not run — needs real testers |
| M9 — Submission | ⬜ | Demo video and writeup outstanding |

**130 TypeScript tests + 21 Python tests passing. `tsc --noEmit` clean.**

---

## Quickstart

Build order is strict (§14): the ML pipeline must be complete before app work,
because designing screens around a model that does not exist means building
them twice.

### 1. ML pipeline

```bash
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python fetch_archive.py     # real 2024 weather for 8 European cities → data/weather_cache.json
python simulate.py --seed 20260729   # 200 patients × 197 days → data/synthetic_panel.csv
python train.py             # → out/model.json inputs, out/report.md, out/figures/
python export.py            # → out/model.json + out/parity_fixtures.json, copied to app/assets/
pytest tests/ -q
```

`fetch_archive.py` caches to `ml/data/`; once it exists nothing else touches the
network. Pass `--offline` to synthesise weather if the archive is unreachable.

### 2. App

```bash
cd app
npm install
npm run test:parity   # §15.1 — the blocking gate. Run this first.
npm test
npm run typecheck
npx expo start
```

The health integration needs a development build; it ships **off** and the app
is fully functional without it (HD-2).

---

## Results

### Simulator (M1)

200 virtual patients × 197 days, built on **real 2024 weather** pulled from the
Open-Meteo archive for London, Berlin, Madrid, Stockholm, Rome, Warsaw, Dublin
and Athens — so environmental correlations are genuine rather than noise (SIM-3).

- **9.01%** flare-positive rate (§8.2 requires 6–12%)
- **20.9%** of flares idiopathic (SIM-5 targets ~20%)
- **15%** of check-in days missing, in runs of 1–4 (SIM-6)
- Byte-identical output for a fixed seed (SIM-8)

Each patient gets 2–3 hidden triggers with per-variable lags and effect sizes,
recorded in `data/ground_truth.json`. **Five variables are never planted** —
`diet_dairy`, `itch`, `uv_index_max`, `pollen_total`, `humidity_mean_pct` —
so trigger recovery is measured against real distractors. `diet_dairy` is the
interesting one: the most commonly *believed* psoriasis trigger, deliberately
given zero effect.

### Model (M2)

L1 logistic regression, `C=0.01`, split by patient (160 train / 40 test).

| Metric | Result | §8.3 target | |
|---|---|---|---|
| Average precision | **0.327** | ≥ 0.30 | ✅ |
| Precision @ threshold | 0.372 | ≥ 0.55 | ❌ |
| Recall @ threshold | 0.328 | ≥ 0.35 | ❌ |
| Planted-trigger share | **0.714** | ≥ 0.60 | ✅ |
| VAL-1 trigger recovery | pass | | ✅ |
| VAL-2 leakage | **fail** | | ❌ |
| VAL-3 null test | pass (1.17× base rate) | | ✅ |
| VAL-4 temporal sanity | pass | | ✅ |

AP 0.327 against a 0.082 base rate is a **4.0× lift**, and 39 of 95 coefficients
survive L1.

### The honest part: why VAL-2 fails

This is the most important finding in the project, so it is reported rather than
tuned away.

| Feature set | Average precision |
|---|---|
| All 95 features | 0.327 |
| `severity_baseline` + `severity_delta` only | **0.345** |
| Lag + roll features only (no severity terms) | 0.172 |
| Base rate | 0.082 |

**Two severity terms alone beat the full model.** The trigger features do carry
real signal — 0.172 against a 0.082 base rate is a 2.1× lift on their own — but
they add almost nothing on top of knowing where today sits relative to the last
fortnight.

The cause is structural, in the §8.1 target definition:

```
flare_next_72h[t] = max(severity[t+1..t+3]) >= mean(severity[t-13..t]) + 3
```

Both sides are built from the same severity series. Because flares persist for
days and the 14-day baseline lags behind them, a day that is *already* elevated
is very likely to satisfy the condition tomorrow. The target therefore counts
flare **continuations**, not just onsets — and continuations are predictable
from current state without reference to any trigger.

This was chased hard before being accepted. Seven levers were swept — clustering
lags to the §7.4 latencies, centring the trigger response, severity noise level
and persistence, flare decay rate, trigger prevalence concentration, and sparse
threshold-based activation. Two produced real, principled improvements and are
kept (below). None separated trigger signal from severity momentum while holding
the flare rate inside the mandated 6–12% band.

Raising AP further *is* easy — a longer flare decay pushes it to 0.40+ — but
`AP_baseline_only` rises in lockstep, so the gain is pure momentum-riding and
VAL-2 correctly rejects it. Optimising the headline number would have meant
optimising away the thing the project exists to measure.

**Consequence for the product:** the Insights screen still shows genuinely
recovered triggers (VAL-1 passes; 71% of selected trigger variables were really
planted). But the Today screen's number is driven mostly by recent severity
trajectory. The risk-detail copy says so in plain language rather than implying
the triggers are doing more work than they are.

Two fixes worth trying next: define the target on flare *onset* only (excluding
days already above baseline + 3), and score per-patient rather than shipping one
population model — though §2 rules the latter out for v1.

### Two simulator bugs this surfaced

Both were real defects, found by taking VAL-2 seriously:

1. **Ceiling artifact.** Trigger signals are non-negative by construction
   (`max(0, ±z)`), so an uncentred accumulated response acted as a permanent
   upward offset rather than an excursion. Severity piled up against the 0–10
   ceiling — 7% of all days sat at exactly 10 — and `baseline + 3 > 10` made a
   flare *arithmetically impossible* on 15.7% of rows. The model was learning
   "predict no flare when the baseline is high". Centring the response fixed it
   (ceiling-blocked rows: 15.7% → 0.3%).

2. **Lag dilution.** Drawing each trigger's lag uniformly from 1–14 as SIM-2
   literally specifies makes every population-level lag coefficient an average
   over 14 latencies, diluting it to nothing. Sampling instead from the window
   §7.4 documents for that trigger — stress 7–14 days, cold snaps 1–3, Koebner
   10–14 — keeps the lags random and inside 1–14 while making them recoverable.

---

## Parity — the test that matters

`ml/features.py` and `app/src/ml/features.ts` implement the same 95-feature spec
twice. When they drift, the app produces confidently wrong predictions and
nothing throws.

`export.py` emits 10 windows from held-out patients with every feature value and
the final probability as Python computed them; a Jest test replays them through
the TypeScript implementation and asserts agreement to `1e-6`. The fixtures are
chosen to exercise the §7.5 missing-data policy — 8 of 10 have gaps, including
runs past the 3-day forward-fill cap, a date absent from the data entirely, and
one window that trips the 40%-missing guard.

```bash
cd app && npm run test:parity   # 42 assertions, blocking in CI
```

Regenerate the fixtures (`python ml/export.py`) whenever either side changes.

---

## Layout

```
fleur/
├── ml/                       Python — offline, never runs in production
│   ├── features.py           SOURCE OF TRUTH for the 95-feature spec
│   ├── fetch_archive.py      real historical weather (cached)
│   ├── simulate.py           200 synthetic patients + ground truth
│   ├── train.py              training, hyperparameter sweep, report
│   ├── validate.py           VAL-1..VAL-4
│   ├── labels.py             feature name → human label
│   ├── export.py             model.json + parity fixtures
│   └── out/                  model.json, report.md, figures/
└── app/                      Expo — bundles model.json, infers on-device
    ├── app/                  expo-router screens
    └── src/
        ├── db/               schema, migrations, queries (snake↔camel boundary)
        ├── ml/               features.ts (MIRRORS features.py), scorer.ts, risk.ts
        ├── api/              openMeteo.ts, health.ts
        └── components/       hand-rolled SVG charts
```

## Testing

| Suite | Command | Covers |
|---|---|---|
| Parity (blocking) | `cd app && npm run test:parity` | §15.1 TEST-1..4 |
| App | `cd app && npm test` | scorer, features, database, API client, bands, slider geometry |
| Types | `cd app && npm run typecheck` | `strict: true`, no `any` |
| ML | `cd ml && pytest tests/ -q` | feature spec, target, guards, VAL-4 |

Database tests run against **real SQLite** via Node's built-in engine, so schema
CHECK constraints and upsert semantics are genuinely exercised — a stub would
happily accept `severity = 47`.

## Interface

The UI was rebuilt from the plain first cut into a designed system, verified
screen by screen on a physical Pixel 7 in both colour schemes.

- **Design tokens** (`src/theme.ts`) — an iris/aqua brand palette with gradient
  ramps, a 7-step type scale, and elevation levels. Every text colour was
  checked against its intended background for WCAG AA.
- **Gradients without a native module** (`src/components/gradient.tsx`) —
  `expo-linear-gradient` is native, so adding it would invalidate any installed
  development build. These paint the same fills with react-native-svg, which is
  already in the bundle.
- **Risk dial** — a 270° gauge whose band zones are fixed fractions of the
  sweep (40% / 26.7% / 33.3%), so the needle can never disagree with the band
  label. The arc animates up from zero on mount.
- **Progress dial** — the pre-forecast state reuses the same dial as fourteen
  dots that fill in one per logged day. A bare "0 of 14" gave the user nothing
  to feel progress against; the two-week cold start is the app's hardest
  moment and now has a shape.
- **Diverging Insights chart** — coefficients extend left or right of a shared
  centre line, making direction structural rather than something you learn by
  reading a label. Words remain for anyone who cannot separate the colours.
- **Lag timeline** — each factor's §7.4 latency window drawn on a 0–21 day
  axis, with a dashed marker at the 14-day limit of what the model can see. It
  makes the sore-throat case honest: part of its window sits beyond the edge.
- **Motion** (`src/components/motion.tsx`) — staggered reveals, spring press
  feedback, and a counting risk percentage, all on React Native's own
  `Animated`. No Reanimated, no rebuild, no new dependency.

Constraints held throughout: no red and no alarm iconography in risk
presentation, colour never the sole carrier of meaning, 44pt minimum targets,
light and dark first-class, and no component library (§11.5).

### v2 redesign

A second design pass (`app/reset-*.tsx`, `app/settings-*.tsx`,
`app/checkin.tsx`, `app/factor-detail.tsx`, `app/backfill.tsx`) reworked the
navigation and the check-in flow:

- **5 tabs** — Today, Insights, History, **Reset**, Settings.
- **Reset** — a non-treatment wellness section (movement, breathwork, eat,
  wind-down, skin, mood). "Today's plan" maps your real top drivers to a
  category via `categoryForVariable`; wind-down and skin-routine checklists
  persist for the day in `meta`; the journal persists for real in a new
  `journal_entry` table (schema v2).
- **5-step check-in** — Skin (+ an "areas affected" tag row, schema v2) →
  Body & wearable → Food & events → Context → Review & rescore. The review
  step's "outlook after saving" is a genuine preview — `withDraftCheckIn` +
  `deriveRiskState` (`src/ml/risk.ts`) score the in-progress draft without
  writing anything, using the same function `AppProvider.recompute` uses.
- **Backfill** and **factor detail** are now dedicated screens rather than a
  date-chip row and a bottom sheet, reachable from Today, History and Insights.
- **Settings** split into five pushed sub-pages (Profile, Permissions,
  Export, Model & disclaimer, Delete all data) instead of one page of modals.
- **Scrubbable trend charts** — `TrendChart`'s `interactive` prop turns touch
  into a day-by-day readout with a persistent tooltip, used on Today and
  History.

## Developer tools

`src/dev/seed.ts`, surfaced as a dashed card at the bottom of Settings. Gated
on `DEV_TOOLS_ENABLED = __DEV__`, so **none of it exists in a release build** —
it is test scaffolding, not product surface.

| Action | What it does |
|---|---|
| Seed 30 days of demo data | Writes a full history so the forecast unlocks |
| Clear today's check-in | Returns today to genuinely un-logged |

It exists because the app is otherwise very hard to review by hand: FR-4.2
hides the risk value until 14 distinct days are logged, and FR-2.4 caps
back-filling at 7 — so on a fresh install the dial, the contributor list and
`/risk-detail` are all unreachable for a fortnight.

The seeded series mirrors what `ml/simulate.py` builds rather than being random
noise: autocorrelated self-reports, a stressful stretch 8-13 days back and an
illness episode 9-12 days back — both at lags the model can actually see, so
the contributor list has real content — plus a recent upward drift so the risk
lands somewhere interesting. A fixed PRNG seed makes it reproducible, and it
writes through the normal `saveCheckIn` path, so seeded rows are subject to the
same constraints as hand-entered ones.

Clearing matters separately: editing a day overwrites it (FR-2.5), so deleting
the row is the only way back to an un-logged date — which is the state the
check-in flow has to be exercised from.

## Spec deviations

Every deviation carries a `// SPEC-DEVIATION:` comment at its site.

1. **Trigger lag distribution** (`ml/simulate.py`) — per-variable windows from
   §7.4 instead of uniform 1–14. Rationale above.
2. **Prior-corrected intercept** (`ml/train.py`) — TR-5 mandates
   `class_weight='balanced'`, which inflates fitted probabilities to ~50%.
   The intercept is shifted by the log prior odds so displayed percentages mean
   what they say. Monotone, so AP is unchanged. (The spec's own example
   `model.json` shows `intercept: -2.1436`, consistent with a calibrated model.)
3. **Rolling-window `min_periods`** (`ml/features.py`) — the spec does not say
   how many observations a window needs. Fixed at `{3:2, 7:5, 14:9}`, hardcoded
   rather than computed, so the two languages cannot disagree on a float boundary.
4. **Stepped check-in** (`app/checkin.tsx`) — §11.3 asks for one scrolling
   form; this is five steps (Skin → Body & wearable → Food & events → Context
   → Review & rescore), at the product owner's request, following the v2
   redesign. Sections still save as exactly one row (FR-2.1), and §11.3's own
   acceptance criterion — severity alone saves in 2 taps — is preserved.
5. **Conditions strip on Today** (`app/(tabs)/index.tsx`) — not in §11.2's
   "Contains" list. It shows the exact environmental inputs the model consumes,
   which makes the forecast legible and justifies the location permission.
6. **VAL-2 reporting** — the literal test (drop `_lag*` only) leaves every
   `_roll*` column in place and understates the problem, so three additional
   cuts are reported and the pass criterion is set on the honest comparison.
7. **Reset tab** (`app/(tabs)/reset.tsx` and `app/reset-*.tsx`) — not in the
   original spec; added in the v2 redesign as a non-treatment "lever on a
   logged input" (movement, breathwork, eat, wind-down, skin, mood). "Today's
   plan" is genuinely derived from `risk.drivers`; only one flagship item per
   category carries authored step-by-step content (from the source design) —
   the rest get an honest overview rather than an invented routine.
8. **No per-day forecast breakdown on Today** — the source design shows a
   three-day "chance it starts that day" row. The model only produces one
   72-hour aggregate probability (§8.1); there is no real per-day sub-score,
   so it is left out. Shown instead: today's probability against the mean of
   your own past predictions ("usual"), computed from the `prediction` log.
9. **Elimination test** (`src/hooks/useEliminationTest.ts`) — real, not
   decorative: picks a candidate only from your current top drivers, runs a
   genuine 14-day two-phase window, and compares real logged severity across
   the two halves. Explicitly labelled as an uncontrolled before/after, never
   a trial. This closes the "elimination-test feature" gap noted below in
   earlier revisions of this README.
10. **Per-factor "evidence" not reproduced** (`app/factor-detail.tsx`) — the
    source design shows fabricated-looking per-feature validation bullets
    (e.g. "recovered in 71% of held-out patients"). No such per-feature stat
    exists in `metrics.json`, so `factor-detail.tsx` shows only real numbers:
    the model's own coefficient, its rank among non-zero features, and the
    curated (real, hand-written) lag explanation from `constants/copy.ts`.

## Not built (§2, binding)

Photo capture, per-user retraining, accounts, sync, social features, doctor
portal, push notifications, medication reminders, watch apps, monetisation, i18n.

Also outstanding: M8 pilot testing and the demo video. (The elimination-test
feature, previously listed here as an M8 stretch goal, now ships — see
Spec deviations §9.)

## Safety

Not a medical device. Not diagnostic. Not clinically validated. The full
disclaimer is shown at onboarding behind an explicit acceptance tap and repeated
in Settings; the short form appears on every screen displaying a risk value.
Risk presentation uses no red, no alarm iconography, and no exclamation marks;
the top band reads "Higher than usual", never "Warning". The Insights screen
carries the §11.4 correlation-not-causation copy verbatim.

## Licence

MIT (§17 default).
