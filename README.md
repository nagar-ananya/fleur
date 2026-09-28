# Fleur — Personal Flare Predictor & Trigger Tracker

> Existing psoriasis apps are diaries. Fleur is a forecast.

An Expo app that scores psoriasis flare risk for the next three days from your
own check-ins, local weather, and (optionally) a wearable. Scoring is a
**hand-written 12-rule points system** that runs entirely on the phone — no
machine learning, no model file, no server.

**No backend, no accounts, no cloud database.** All storage is local SQLite. The
only outbound request in the product goes to Open-Meteo, carrying nothing but
rounded coordinates — unless you switch on the optional AI second opinion, which
is off by default and described below.

Built against [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md).
The scoring design is in
[`docs/rules-engine-design.md`](docs/rules-engine-design.md).

## Status

| | |
|---|---|
| Scoring | ✅ 12-rule points system, measured on 300 held-out simulated patients |
| App | ✅ 5 tabs, 5-step check-in, backfill, Reset, Insights, CSV export |
| Tests | ✅ 97 passing, `tsc --noEmit` clean |
| Verified on device | ✅ Pixel 7, light and dark |
| AI second opinion | ⚠️ built and wired, **unmeasured** — no accuracy claim is made for it |
| Pilot testing | ⬜ not run |
| Demo video | ⬜ outstanding |

---

## How the score works

Every risk factor is worth a number of points. Stress is worth up to 15. Being
unwell recently is worth up to 10. Skin already climbing above your own
two-week average is worth up to 60, because that is by far the strongest
signal. Add up today's points, cap at 100, read off a band:

| Band | Score |
|---|---|
| Low | 0–29 |
| Elevated | 30–49 |
| Higher than usual | 50–100 |

That is the whole system. Twelve rules, whole numbers, one addition — and the
app shows you the arithmetic, so you can check it by hand.

The **time windows are not invented**: they come from `REQUIREMENTS.md` §7.4,
which lists how long published research says each trigger takes to show up
(stress 7–14 days, cold snap 1–3, Koebner 10–14, strep 14–21).

The app shows a band and a score and **makes no claim about how often a flare
actually follows**. The score is a tally, not a probability, and is never
printed with a `%`.

---

## Does it work?

Measured by `app/scripts/check-numbers.ts` — the app's own engine, run over
**300 simulated patients held back** while the rules were written, 47,480
scoreable days.

| What Fleur said | How often | A flare actually followed within 3 days |
|---|---|---|
| Low (0–29) | 80.1% of days | **5.0%** |
| Elevated (30–49) | 12.8% | **14.6%** |
| Higher than usual (50–100) | 7.1% | **44.5%** |

> When Fleur says "higher than usual", a flare followed almost half the time.
> When it says "low", about 1 day in 20. Base rate across all days is 9.1%.

It still finds real triggers: the simulator plants 2–3 hidden triggers per
patient, and on top-band days the highest-scoring rule pointed at a genuinely
planted one **54%** of the time, against ~15% by chance.

These numbers live on Settings → Scoring, and nowhere else in the app.

### Why there is no machine learning any more

This project started with a trained L1 logistic regression on 1,500 simulated
patients. Measuring what it had actually learned was the turning point:

| Feature | Weight in the trained model |
|---|---|
| How far today sits above your 14-day average | **+0.86** — biggest by 4× |
| Your usual level lately | −0.23 |
| The other 69 features | ≤ 0.20 each |

Its own report put `baseline_share_of_full` at **0.957** — those two terms alone
recovered 95.7% of the full model. The machine learning had spent 295,500 rows
discovering "skin that has already started moving tends to keep moving", which
is one line of arithmetic.

So it was replaced with rules, and the replacement measured. On an identical
held-out row set the two scored **0.391** (trained model) against **0.385** for
an earlier 16-rule version of the rulebook — essentially the same accuracy, with
nothing learned from data. The shipped 12-rule version trades a little of that
for far simpler rules a reader can check.

**The honest part:** the rules inherit the trained model's biggest weakness
exactly. Dropping every trigger rule and keeping only the two skin rules costs
very little, because the §8.1 target counts flare *continuations*, not just
onsets — a day already elevated is very likely to still be elevated tomorrow.
That limitation lives in the target definition, not the choice of model, and
switching to rules neither caused nor fixed it. It is the most interesting
finding in the project and is reported rather than tuned away.

---

## Quickstart

```bash
cd app
npm install
npm test          # 97 tests
npm run typecheck # strict, no any
npx expo start
```

There is no build step for the scoring system — `assets/rulebook.json` is
hand-written and read directly.

### Re-measuring the numbers (optional)

Only needed if you change a rule's points or marks. The simulator generates the
held-out test data; it is not part of the product and never runs on a phone.

```bash
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python fetch_archive.py              # real 2024 weather, cached
python simulate.py --seed 20260729   # 1500 patients x 197 days -> data/synthetic_panel.csv

cd ../app
npx tsx scripts/check-numbers.ts ../ml/data/synthetic_panel.csv
```

Paste the printed band rates into `assets/rulebook.json` → `results`, and update
`measured_at`. **The script trains nothing** — it runs the app's own `scoreDay`
and counts how often a flare really followed.

---

## The simulator

1500 virtual patients x 197 days, built on **real 2024 weather** from the
Open-Meteo archive for eight European cities, so environmental correlations are
genuine rather than noise.

- **9.26%** flare-positive rate (§8.2 requires 6–12%)
- **23.9%** of flares idiopathic
- **15%** of check-in days missing, in runs of 1–4
- Byte-identical output for a fixed seed

Each patient gets 2–3 hidden triggers with per-variable lags and effect sizes,
recorded in `data/ground_truth.json`. **Five variables are never planted** —
`diet_dairy`, `itch`, `uv_index_max`, `pollen_total`, `humidity_mean_pct` — so
trigger recovery is measured against real distractors. `diet_dairy` is the
interesting one: the most commonly *believed* psoriasis trigger, deliberately
given zero effect.

### Two simulator bugs this surfaced

Both were real defects, found by taking the validation seriously:

1. **Ceiling artifact.** Trigger signals are non-negative by construction, so an
   uncentred accumulated response acted as a permanent upward offset. Severity
   piled up against the 0–10 ceiling — 7% of days sat at exactly 10 — and
   `baseline + 3 > 10` made a flare *arithmetically impossible* on 15.7% of rows.
   Centring the response fixed it (ceiling-blocked rows: 15.7% → 0.3%).
2. **Lag dilution.** Drawing each trigger's lag uniformly from 1–14 makes every
   population-level lag coefficient an average over 14 latencies, diluting it to
   nothing. Sampling instead from the window §7.4 documents for that trigger
   keeps the lags random and inside 1–14 while making them recoverable.

---

## Optional: AI second opinion

Off by default. When switched on in Settings, Fleur also asks Claude for a
second read on the same two weeks and shows it as a **separate card** that
agrees or disagrees.

- **The local score is always the number on Today.** The AI never replaces it.
  Offline, no key, rate-limited, bad response — the score is unaffected, because
  it was never waiting on the network.
- **What gets sent:** 14 rows of numbers. No name, no dates, no location, no
  notes, nothing from your profile.
- **Your own API key**, stored in the device keystore. Fleur ships no key and
  has no server. "Delete all data" clears it.
- **It has not been measured** against the points system, so the app makes no
  accuracy claim about it. It is also not reproducible — ask twice and it can
  differ — which is the main reason the local score stays the headline.

This is a **deliberate deviation from PRIV-1/PRIV-2**, which say no user data
leaves the device. It is opt-in, disclosed on its own screen showing the exact
payload, and recorded in Spec deviations below.

---

## Layout

```
fleur/
├── ml/                       Test-data generator. Not part of the product,
│   ├── simulate.py             never runs on a phone, run by hand.
│   ├── fetch_archive.py      real historical weather (cached)
│   ├── features.py           simulator support only
│   └── data/                 gitignored — regenerate with simulate.py
└── app/
    ├── assets/rulebook.json  THE SCORING SYSTEM — hand-written, 12 rules
    ├── scripts/
    │   └── check-numbers.ts  re-measures the rulebook (trains nothing)
    ├── app/                  expo-router screens
    └── src/
        ├── logic/            frame.ts, signals.ts, engine.ts, risk.ts, personal.ts
        ├── ai/               optional second opinion (off by default)
        ├── db/               schema, migrations, queries (snake↔camel boundary)
        ├── api/              openMeteo.ts, health.ts
        └── components/       hand-rolled SVG charts
```

**The app consumes nothing from `ml/`.** No generated file, no bundled artifact,
no import. Deleting the whole folder leaves a working app — you would just lose
the ability to re-measure the numbers on Settings → Scoring.

## Testing

| Suite | Command | Covers |
|---|---|---|
| App | `cd app && npm test` | 97 tests: engine, signals, risk states, rulebook integrity, database, API client, chart geometry |
| Types | `cd app && npm run typecheck` | `strict: true`, no `any` |

Database tests run against **real SQLite** via Node's built-in engine, so schema
CHECK constraints and upsert semantics are genuinely exercised — a stub would
happily accept `severity = 47`.

**The old blocking parity test is gone, and that is the point.** It existed
because `ml/features.py` and `app/src/ml/features.ts` were two implementations
of one 95-feature spec that could silently drift. The scoring engine is now
written once, in TypeScript, and the measurement script runs that same code — so
there is nothing left to keep in sync. What replaces it is a fast
rulebook-integrity test: every rule points at a column the frame builds, every
rule variable has explanation copy, ids are unique, bands are ordered, and no
user-facing string claims a flare frequency.

Worth knowing: the engine test asserts a worked example by hand —
20.4 + 12.2 + 10.0 − 8.6 + … = 54.3 → **54 points, Elevated** — so a change that
alters the arithmetic fails loudly.

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
- **Diverging Insights chart** — points extend left or right of a shared
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
illness episode 9-12 days back — both at lags the rules can actually see, so
the contributor list has real content — plus a recent upward drift so the risk
lands somewhere interesting. A fixed PRNG seed makes it reproducible, and it
writes through the normal `saveCheckIn` path, so seeded rows are subject to the
same constraints as hand-entered ones.

Clearing matters separately: editing a day overwrites it (FR-2.5), so deleting
the row is the only way back to an un-logged date — which is the state the
check-in flow has to be exercised from.

## Spec deviations

Every deviation carries a `// SPEC-DEVIATION:` comment at its site.

1. **No machine learning** (§8, §9) — the spec mandates L1 logistic regression
   trained on the simulator, a `model.json` contract, and z-scored inference.
   All of it is replaced by a hand-written points system. Rationale and
   measurements: [`docs/rules-engine-design.md`](docs/rules-engine-design.md).
   §7's 95-feature spec, §8's training procedure and §9's scoring algorithm are
   superseded.
2. **No parity test** (§15.1) — it was blocking because two languages
   implemented one spec. There is now one implementation, so the test has
   nothing to guard. Replaced by a rulebook-integrity test.
3. **Score, not probability** (§9.4, §11.2) — the app shows 0–100 points and a
   band, never a percentage, and makes no claim about how often a flare follows.
   A frequency claim would need a measurement to stay true and would go stale
   the moment a rule changed; a tally cannot.
4. **Optional AI second opinion breaks PRIV-1/PRIV-2** — those say health data
   MUST NOT leave the device, ever. The feature is off by default, needs an
   explicit opt-in, shows the exact payload before sending, and transmits 14
   rows of numbers with no name, dates, location, notes or profile. §5.3's "no
   API keys anywhere" also no longer holds: the user supplies their own.
5. **Trigger lag distribution** (`ml/simulate.py`) — per-variable windows from
   §7.4 instead of uniform 1–14. Rationale above.
6. **Rolling-window `min_periods`** (`src/logic/frame.ts`) — the spec does not
   say how many observations a window needs. Fixed at `{3:2, 7:5, 14:9}`.
7. **Stepped check-in** (`app/checkin.tsx`) — §11.3 asks for one scrolling
   form; this is five steps, at the product owner's request. Sections still save
   as exactly one row (FR-2.1), and §11.3's own acceptance criterion — severity
   alone saves in 2 taps — is preserved.
8. **Conditions strip on Today** — not in §11.2's "Contains" list. It shows the
   exact environmental inputs the weather rules read, which makes the score
   legible and justifies the location permission.
9. **Reset tab** — not in the original spec; added in the v2 redesign as a
   non-treatment "lever on a logged input". "Today's plan" is genuinely derived
   from `risk.drivers`.
10. **No per-day forecast breakdown on Today** — the source design shows a
    three-day "chance it starts that day" row. There is one 72-hour score and no
    real per-day sub-score, so it is left out. Shown instead: today's score
    against the mean of your own past scores.
11. **Elimination test** (`src/hooks/useEliminationTest.ts`) — real, not
    decorative: picks a candidate only from your current top drivers, runs a
    genuine 14-day two-phase window, and compares real logged severity across
    the two halves. Explicitly labelled as an uncontrolled before/after.
12. **Insights shows your own data** (§11.4) — the spec's chart is population
    coefficients. It now shows the average points each rule has contributed
    across *your* logged days, with the authored rulebook weights as a second
    chart. §11.4's required preamble is still verbatim.

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
