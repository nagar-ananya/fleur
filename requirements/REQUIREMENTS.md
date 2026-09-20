# Fleur — Personal Flare Predictor & Trigger Tracker

**Requirements & Technical Specification, v1.0**

Status: Draft for implementation
Target: 8-week solo build (student project / app challenge submission)
Audience: coding agents and the human developer

---

## Project at a glance

**If you are a coding agent, read this section and §0 before anything else. Everything from §1 onward is detail.**

### What this is

A **two-part monorepo**, built by one developer over 8 weeks:

1. **`ml/` — a Python offline pipeline.** Generates synthetic training data, trains a logistic regression classifier, exports it as a static JSON file. Runs on a laptop or in Colab. Never runs in production.
2. **`app/` — a React Native mobile app (Expo).** Ships that JSON file as a bundled asset and does inference on-device in TypeScript.

**There is no backend, no server, no cloud database, and no user accounts.** All persistence is local SQLite on the phone. The only outbound network call in the entire product is to a free, keyless public weather API. If you find yourself writing an Express server, an auth flow, or a Dockerfile, you have misread this document.

### Stack

| Layer | Technology | Notes |
|---|---|---|
| Mobile framework | **Expo (React Native)**, latest stable SDK | Managed workflow |
| Mobile language | **TypeScript**, `strict: true` | No `any` |
| Routing | **expo-router** | File-based |
| Local database | **expo-sqlite** | 5 tables, on-device only |
| State | React Context + hooks | No Redux/Zustand/MobX |
| Charts | **react-native-svg**, hand-rolled components | No charting library |
| ML training | **Python 3.11+**, scikit-learn, pandas, numpy | Offline only |
| Model | **L1 logistic regression** → `model.json` | ~95 features, 2 KB file |
| Inference | Plain TypeScript in the app | One dot product + sigmoid |
| External API | **Open-Meteo** (weather + air quality) | Free, no API key |
| Backend | **None** | Intentional — see §13.3 |
| Auth | **None** | Intentional |
| Tests | jest + @testing-library/react-native (app), pytest (ml) | |

### Structure

```
fleur/
├── REQUIREMENTS.md      # this document
├── ml/                  # Python — build this FIRST, then freeze it
│   ├── simulate.py      # synthetic patients          → M1
│   ├── features.py      # feature engineering (SOURCE OF TRUTH)
│   ├── train.py         # training + validation       → M2
│   ├── export.py        # writes model.json           → M3
│   └── out/model.json   # the deliverable, copied into app/assets/
└── app/                 # Expo — build this SECOND
    ├── assets/model.json
    ├── app/             # expo-router screens
    └── src/
        ├── db/          # SQLite schema + queries
        ├── ml/          # features.ts (MIRRORS features.py), scorer.ts
        ├── api/         # Open-Meteo client
        └── components/
```

Full tree in [§12](#12-repository-structure). Full stack rationale in [§5](#5-technical-stack).

### Build order

**Strictly sequential. Do not start `app/` until `ml/out/model.json` exists and passes the parity test.**

```
M1 simulator → M2 train → M3 export  ──┐  (Python, weeks 2-4)
                                       ├─→ M4 app shell → M5 check-in
                                       │   → M6 integrations → M7 risk UI
                                       │   → M8 pilot → M9 submit
                                       └   (Expo, weeks 5-8)
```

Building the app first means designing screens around a model that does not exist yet, then rebuilding them. Full milestone table with exit criteria in [§14](#14-milestones--build-order).

### Scaffold commands

The literal first actions for an agent starting from an empty directory:

```bash
mkdir fleur && cd fleur
git init

# --- ML side (build and complete this first) ---
mkdir -p ml/data ml/out/figures
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install numpy pandas scikit-learn matplotlib requests pytest
pip freeze > requirements.txt
cd ..

# --- App side (do not start until model.json exists) ---
npx create-expo-app@latest app --template default
cd app
npx expo install expo-sqlite expo-location react-native-svg
npm install --save-dev jest-expo @testing-library/react-native
cd ..

printf 'ml/.venv/\nml/data/\nnode_modules/\n.expo/\n' > .gitignore
```

Set `"strict": true` in `app/tsconfig.json` before writing any TypeScript.

### The two things most likely to go wrong

1. **Python/TypeScript feature drift.** `ml/features.py` and `app/src/ml/features.ts` implement the same 95-feature spec twice. When they diverge, the app silently produces wrong predictions with no error. The parity test in [§15.1](#151-parity-test-blocking) is mandatory and blocking.
2. **Scope creep.** [§2 Non-goals](#2-non-goals) is binding, not advisory. Photos, accounts, sync, notifications, and per-user model training are all explicitly excluded.

---

## 0. How to use this document

This spec is written to be handed directly to a coding agent. Read *Project at a glance* above, then this section, before any other part of the document.

### Ground rules for agents

1. **Build in the order given in [§14 Milestones](#14-milestones--build-order).** The ML pipeline (M1–M3) must be complete and frozen before app work begins. Do not start the Expo app until `model.json` exists and passes the parity test.
2. **Do not add features that are not in this document.** [§2 Non-goals](#2-non-goals) is binding. If a feature seems obviously useful but is not listed, it is out of scope for v1.
3. **Do not substitute a more advanced model.** The choice of L1 logistic regression is deliberate (see [§8.4](#84-why-logistic-regression)). Do not "upgrade" to a neural network, LSTM, gradient boosting, or transformer.
4. **Every threshold, field name, and constant in this document is normative.** Use the exact names given. If you must deviate, leave a `// SPEC-DEVIATION:` comment explaining why.
5. **When a third-party API parameter name is uncertain, verify against live docs before coding.** Open-Meteo parameter names in [§10](#10-external-integrations) were correct at time of writing but must be confirmed.
6. **Ask before assuming** on anything involving: medical claims, data sharing, or user-facing health language. Everywhere else, prefer making a reasonable choice and documenting it over stopping to ask.

### Definition of done for v1

A person can install the app, log daily check-ins for two weeks, and see a 72-hour flare risk percentage plus a ranked list of their likely personal triggers, computed on-device, with no server round-trip for prediction.

---

## 1. Overview

### 1.1 Problem

Psoriasis flare-ups are driven by environmental and lifestyle factors — weather shifts, sleep disruption, stress, diet, illness, skin injury — but the relationship is individual and lagged. A trigger may precede a flare by anywhere from one day to three weeks, which makes it nearly impossible to identify by memory or by a simple diary.

### 1.2 What exists today

Several psoriasis tracking apps exist (Psoriasis Monitor, Psoriasis Tracker, CareClinic, and others). All of them are **retrospective**: they record what happened and report which triggers were logged most often near flares. None of them produce a forward-looking risk forecast.

### 1.3 What this project does differently

Fleur is **prospective**. It combines self-reported daily check-ins, automatically fetched environmental data, and optional wearable data, applies lagged feature engineering, and outputs a probability that a flare will begin in the next 72 hours — along with the specific factors currently driving that number.

### 1.4 Positioning statement

> Existing psoriasis apps are diaries. Fleur is a forecast.

### 1.5 What this is not

A prototype and educational project. **Not a medical device, not diagnostic, not a substitute for dermatological care.** See [§13 Safety & compliance](#13-safety-privacy--compliance).

---

## 2. Non-goals

These are explicitly **out of scope for v1**. Do not implement them.

| Excluded | Reason |
|---|---|
| Photo capture and image-based severity scoring | A full computer-vision subproject; would consume the entire timeline |
| Per-user personalized model retraining on-device | Requires 6+ months of data per user; v1 ships the population model only |
| User accounts, login, cloud sync, multi-device | Local-only storage removes an entire class of privacy and auth work |
| Social features, community, sharing feeds | Not related to the core hypothesis |
| Doctor portal, PDF report export, EHR integration | Nice-to-have; add in v2 if time remains |
| Push notifications | Requires build-time config and store review complications; v1 surfaces risk in-app only |
| Medication reminder scheduling | Scope creep; logging adherence is in scope, reminding is not |
| Apple Watch / Wear OS companion app | Out of scope; read wearable data through the phone's health store only |
| Monetization, subscriptions, paywalls | Not applicable |
| Localization / i18n | English only for v1 |

---

## 3. Users and primary flows

### 3.1 Primary persona

Adult with diagnosed plaque psoriasis, moderate technical comfort, motivated to understand their own patterns. Willing to spend under 60 seconds per day in the app.

### 3.2 Core flows

**F1 — First run**
Onboarding → disclaimer acceptance → profile (psoriasis type, year of onset) → location permission → optional health permission → land on Today screen showing "collecting data, 14 days needed."

**F2 — Daily check-in** (the critical flow — must complete in under 30 seconds)
Open app → Today screen shows check-in prompt → single scrolling form → save → return to Today with updated risk.

**F3 — Understanding risk**
Today screen shows risk gauge → tap gauge → detail view listing the top contributing factors with plain-language explanations.

**F4 — Understanding personal triggers**
Insights tab → ranked bar chart of factor influence → tap a factor → explanation of its typical lag and the evidence behind it.

**F5 — Reviewing history**
History tab → calendar heatmap of severity → tap a day → that day's logged values.

---

## 4. Functional requirements

Requirements use MUST / SHOULD / MAY per RFC 2119.

### 4.1 Onboarding

| ID | Requirement |
|---|---|
| FR-1.1 | The app MUST display a medical disclaimer on first launch. The user MUST tap an explicit acceptance control before proceeding. |
| FR-1.2 | The app MUST collect: psoriasis type (enum), approximate year of onset (int), and whether the user is currently on a systemic/biologic treatment (bool). |
| FR-1.3 | The app MUST request coarse location permission and MUST degrade gracefully to a manually entered city if denied. |
| FR-1.4 | The app SHOULD request health-store read permission for sleep, resting heart rate, and steps. It MUST function fully if denied. |
| FR-1.5 | Onboarding MUST be completable in under 90 seconds. |

### 4.2 Daily check-in

| ID | Requirement |
|---|---|
| FR-2.1 | The app MUST present a single check-in form covering all fields in [§6.2](#62-checkin-table). |
| FR-2.2 | Every field except `severity` MUST be optional. `severity` MUST be required to save. |
| FR-2.3 | The form MUST pre-fill with yesterday's values for slider fields, to reduce input effort. |
| FR-2.4 | The app MUST allow backfilling a check-in for any date in the past 7 days. |
| FR-2.5 | The app MUST allow exactly one check-in per calendar date; a second save for the same date overwrites the first. |
| FR-2.6 | Slider fields MUST show both the numeric value and a text anchor at each end (e.g. "0 — none" / "10 — worst ever"). |

### 4.3 Environmental data

| ID | Requirement |
|---|---|
| FR-3.1 | On app open, if the last environment fetch is older than 6 hours, the app MUST fetch the last 14 days plus the 3-day forecast from Open-Meteo. |
| FR-3.2 | Fetched environment data MUST be written to local storage and MUST be usable offline. |
| FR-3.3 | A failed fetch MUST NOT block any other app function. The app MUST show a non-blocking "environment data unavailable" indicator. |
| FR-3.4 | The app MUST NOT fetch environment data more than once per hour under any circumstances. |

### 4.4 Risk prediction

| ID | Requirement |
|---|---|
| FR-4.1 | The app MUST compute a 72-hour flare risk probability entirely on-device, with no network call. |
| FR-4.2 | The app MUST NOT display a risk value until at least 14 distinct days of check-in data exist. Before that it MUST show a progress indicator ("11 of 14 days"). |
| FR-4.3 | Risk MUST be recomputed on: app open, check-in save, and successful environment fetch. |
| FR-4.4 | The app MUST display, alongside the risk value, the top 3 features by absolute contribution to the current score, in plain language. |
| FR-4.5 | The app MUST classify risk into bands per [§9.4](#94-risk-bands) and MUST use the band label, not the raw percentage, as the primary visual. |
| FR-4.6 | Every screen displaying risk MUST carry the short-form disclaimer from [§13.2](#132-required-disclaimer-text). |

### 4.5 Insights

| ID | Requirement |
|---|---|
| FR-5.1 | The Insights screen MUST show a horizontal bar chart of the model's top 8 features by absolute standardized coefficient. |
| FR-5.2 | Each bar MUST be labelled in plain English, not with the raw feature name. `stress_lag7` renders as "Stress, about a week ago". |
| FR-5.3 | The screen MUST state in visible copy that these are **associations, not proven causes**. |
| FR-5.4 | Tapping a bar MUST open a detail sheet explaining the factor and its typical lag. |

### 4.6 History

| ID | Requirement |
|---|---|
| FR-6.1 | The History screen MUST show a calendar heatmap of daily `severity` for the trailing 90 days. |
| FR-6.2 | Tapping a day MUST show all logged values for that date, and MUST allow editing if the date is within the last 7 days. |
| FR-6.3 | The app MUST provide a "export my data as CSV" action in Settings. |

### 4.7 Settings

| ID | Requirement |
|---|---|
| FR-7.1 | Settings MUST include: edit profile, manage permissions, export CSV, delete all data, view disclaimer, view model version. |
| FR-7.2 | "Delete all data" MUST require a typed confirmation and MUST irreversibly clear the local database. |

---

## 5. Technical stack

Pin these. Do not substitute.

### 5.1 Mobile app

| Concern | Choice | Notes |
|---|---|---|
| Framework | React Native via **Expo SDK (latest stable)** | Managed workflow. Testable on a physical phone without a Mac. |
| Language | **TypeScript**, `strict: true` | `any` is disallowed outside declared third-party shims. |
| Navigation | **expo-router** | File-based routing. |
| Local storage | **expo-sqlite** | Single local DB file. No cloud. |
| State | React Context + hooks | Do not add Redux, Zustand, or MobX. |
| Charts | **react-native-svg** with hand-rolled chart components | Avoid heavy charting dependencies; the charts needed are simple. |
| Health data | **react-native-health** (iOS) / **react-native-health-connect** (Android) | Requires an Expo development build, not Expo Go. See [§10.2](#102-health-data). |
| Location | **expo-location** | Coarse accuracy is sufficient. |
| Testing | **jest** + **@testing-library/react-native** | |

### 5.2 ML pipeline

| Concern | Choice |
|---|---|
| Language | Python 3.11+ |
| Environment | Google Colab or local venv |
| Libraries | `numpy`, `pandas`, `scikit-learn`, `matplotlib`, `requests` |
| Model | `sklearn.linear_model.LogisticRegression(penalty='l1', solver='liblinear')` |
| Secondary model | `sklearn.tree.DecisionTreeClassifier(max_depth=3)` — for explanation figures only, not shipped |

### 5.3 External services

| Service | Purpose | Cost | Auth |
|---|---|---|---|
| Open-Meteo Forecast API | Daily weather | Free | None |
| Open-Meteo Air Quality API | PM2.5, pollen, ozone | Free | None |
| Open-Meteo Historical Archive API | Backfill for simulator | Free | None |

No API keys are required anywhere in this project. There is no backend server.

---

## 6. Data model

All storage is local SQLite. Schema version is tracked in a `meta` table for migrations.

### 6.1 `profile` table

Single row, id always `1`.

```sql
CREATE TABLE profile (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  psoriasis_type    TEXT NOT NULL,   -- 'plaque' | 'guttate' | 'inverse' | 'pustular' | 'erythrodermic' | 'unknown'
  onset_year        INTEGER,
  on_systemic       INTEGER NOT NULL DEFAULT 0,  -- 0/1
  latitude          REAL,
  longitude         REAL,
  city_label        TEXT,
  disclaimer_ack_at TEXT NOT NULL,   -- ISO-8601
  created_at        TEXT NOT NULL
);
```

### 6.2 `checkin` table

One row per calendar date.

```sql
CREATE TABLE checkin (
  date              TEXT PRIMARY KEY,  -- 'YYYY-MM-DD', local timezone
  severity          INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10),
  itch              INTEGER CHECK (itch BETWEEN 0 AND 10),
  stress            INTEGER CHECK (stress BETWEEN 0 AND 10),
  sleep_hours       REAL    CHECK (sleep_hours BETWEEN 0 AND 16),
  water_glasses     INTEGER CHECK (water_glasses BETWEEN 0 AND 25),
  alcohol_units     REAL    CHECK (alcohol_units BETWEEN 0 AND 20),
  diet_dairy        INTEGER DEFAULT 0,
  diet_gluten       INTEGER DEFAULT 0,
  diet_processed    INTEGER DEFAULT 0,
  diet_sugar        INTEGER DEFAULT 0,
  diet_red_meat     INTEGER DEFAULT 0,
  illness           INTEGER DEFAULT 0,   -- any cold/sore throat/fever today
  sore_throat       INTEGER DEFAULT 0,   -- tracked separately: classic guttate trigger
  skin_injury       INTEGER DEFAULT 0,   -- cut, scratch, sunburn, friction (Koebner)
  new_product       INTEGER DEFAULT 0,   -- new soap, detergent, fragrance
  med_taken         INTEGER DEFAULT 0,   -- adherence to prescribed treatment
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
```

### 6.3 `environment` table

One row per calendar date per location. Populated from Open-Meteo.

```sql
CREATE TABLE environment (
  date              TEXT PRIMARY KEY,
  temp_mean_c       REAL,
  temp_min_c        REAL,
  temp_max_c        REAL,
  humidity_mean_pct REAL,
  dew_point_c       REAL,
  pressure_hpa      REAL,
  uv_index_max      REAL,
  precipitation_mm  REAL,
  wind_speed_max    REAL,
  pm2_5             REAL,
  pm10              REAL,
  ozone             REAL,
  pollen_total      REAL,   -- sum of available pollen species
  is_forecast       INTEGER NOT NULL DEFAULT 0,
  fetched_at        TEXT NOT NULL
);
```

### 6.4 `wearable` table

Optional; may be entirely empty.

```sql
CREATE TABLE wearable (
  date              TEXT PRIMARY KEY,
  sleep_hours       REAL,
  sleep_efficiency  REAL,
  resting_hr        REAL,
  steps             INTEGER,
  source            TEXT,   -- 'healthkit' | 'health_connect'
  fetched_at        TEXT NOT NULL
);
```

### 6.5 `prediction` table

Append-only log of every computed risk, for later evaluation.

```sql
CREATE TABLE prediction (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  computed_at       TEXT NOT NULL,
  for_date          TEXT NOT NULL,       -- date the prediction was made from
  probability       REAL NOT NULL,
  band              TEXT NOT NULL,       -- 'low' | 'elevated' | 'high'
  model_version     TEXT NOT NULL,
  top_features      TEXT NOT NULL        -- JSON array of {feature, contribution}
);
```

### 6.6 TypeScript types

Mirror these exactly in `app/src/types/models.ts`. Nullable columns map to `| null`, never to `undefined`.

```ts
export type PsoriasisType =
  | 'plaque' | 'guttate' | 'inverse' | 'pustular' | 'erythrodermic' | 'unknown';

export type RiskBand = 'low' | 'elevated' | 'high';

export interface CheckIn {
  date: string;              // 'YYYY-MM-DD'
  severity: number;          // 0-10, required
  itch: number | null;
  stress: number | null;
  sleepHours: number | null;
  waterGlasses: number | null;
  alcoholUnits: number | null;
  dietDairy: boolean;
  dietGluten: boolean;
  dietProcessed: boolean;
  dietSugar: boolean;
  dietRedMeat: boolean;
  illness: boolean;
  soreThroat: boolean;
  skinInjury: boolean;
  newProduct: boolean;
  medTaken: boolean;
  notes: string | null;
}
```

---

## 7. Feature engineering specification

This is the most important section. The app's TypeScript implementation and the Python training implementation **must produce byte-identical feature vectors**. This is enforced by the parity test in [§15.1](#151-parity-test-blocking).

### 7.1 Base variables

Assembled by joining `checkin`, `environment`, and `wearable` on `date`, producing one row per date.

**Self-reported (14):** `severity`, `itch`, `stress`, `sleep_hours`, `water_glasses`, `alcohol_units`, `diet_dairy`, `diet_gluten`, `diet_processed`, `diet_sugar`, `diet_red_meat`, `illness`, `sore_throat`, `skin_injury`

**Environment (8):** `temp_mean_c`, `humidity_mean_pct`, `dew_point_c`, `pressure_hpa`, `uv_index_max`, `precipitation_mm`, `pm2_5`, `pollen_total`

**Wearable (3, optional):** `sleep_hours_device`, `resting_hr`, `steps`

### 7.2 Derived variables

Computed before lagging:

```
temp_delta_1d      = temp_mean_c[t] - temp_mean_c[t-1]
humidity_delta_1d  = humidity_mean_pct[t] - humidity_mean_pct[t-1]
pressure_delta_1d  = pressure_hpa[t] - pressure_hpa[t-1]
sleep_debt_7d      = max(0, 7*7.5 - sum(sleep_hours[t-6..t]))
severity_baseline  = mean(severity[t-13..t])
severity_delta     = severity[t] - severity_baseline[t]
```

### 7.3 Lag and rolling specification

```python
LAG_VARS = [
    'stress', 'sleep_hours', 'itch', 'alcohol_units',
    'diet_dairy', 'diet_processed', 'diet_sugar',
    'illness', 'sore_throat', 'skin_injury',
    'temp_delta_1d', 'humidity_delta_1d', 'pressure_delta_1d',
    'uv_index_max', 'pm2_5', 'pollen_total', 'humidity_mean_pct',
]
LAGS = [1, 3, 7, 14]

ROLL_VARS = ['stress', 'sleep_hours', 'itch', 'alcohol_units',
             'uv_index_max', 'pm2_5', 'humidity_mean_pct']
ROLL_WINDOWS = [3, 7, 14]

# Also included unlagged:
CURRENT_VARS = ['severity_baseline', 'severity_delta', 'sleep_debt_7d',
                'temp_mean_c', 'humidity_mean_pct', 'uv_index_max']
```

Naming convention, exactly: `{var}_lag{n}` and `{var}_roll{n}`. Example: `stress_lag7`, `pm2_5_roll14`.

Total feature count: `17 × 4 + 7 × 3 + 6 = 95`.

### 7.4 Rationale for the lag windows

Trigger latencies documented in the literature, which the lag set is designed to span:

| Trigger | Typical latency to flare |
|---|---|
| Cold snap / humidity drop | 1–3 days |
| Sleep deprivation | 3–7 days |
| Psychological stress | 7–14 days |
| Skin injury (Koebner) | 10–14 days |
| Streptococcal / sore throat | 14–21 days |

Note the 21-day case is only partially captured by a 14-day maximum lag. This is a known, documented limitation — record it in the project writeup rather than extending the lag set, which would inflate the feature count past what the training data supports.

### 7.5 Missing data policy

Applied in this order, identically in Python and TypeScript:

1. Forward-fill any base variable for up to **3 consecutive days**.
2. Any value still missing is set to the **training-set mean** for that variable (available in `model.json`).
3. If more than **40% of the last 14 days** have no check-in at all, do not predict. Return `null` and have the UI show "not enough recent data."

### 7.6 Standardization

Every feature is z-scored using the means and standard deviations from the training set, shipped in `model.json`:

```
z_i = (x_i - mean_i) / std_i        where std_i < 1e-8 → z_i = 0
```

---

## 8. Machine learning specification

### 8.1 Target definition

```
baseline[t]  = mean(severity[t-13 .. t])
flare_next_72h[t] = 1 if max(severity[t+1], severity[t+2], severity[t+3]) >= baseline[t] + 3
                    else 0
```

Rows where any of `severity[t+1..t+3]` is missing MUST be dropped from training, not imputed.

### 8.2 Synthetic data generator

Located at `ml/simulate.py`. This is the project's key methodological contribution — it provides **known ground truth**, allowing the model to be validated by checking whether it recovers triggers that were deliberately planted.

Requirements:

| ID | Requirement |
|---|---|
| SIM-1 | MUST generate **200 virtual patients × 180 days**. |
| SIM-2 | Each patient MUST be assigned 2–3 hidden triggers drawn at random from `LAG_VARS`, each with a random lag in 1–14 days and a random effect size in 0.8–2.5 severity points. |
| SIM-3 | Real historical weather MUST be pulled from the Open-Meteo Archive API for at least 5 distinct cities and reused across patients, so environmental correlations are realistic rather than random noise. |
| SIM-4 | Self-reported variables MUST be generated with realistic autocorrelation (stress and sleep are not i.i.d. day to day). Use an AR(1) process with φ ≈ 0.6. |
| SIM-5 | Approximately **20% of flares MUST have no assigned cause** (idiopathic), to prevent an unrealistically clean signal. |
| SIM-6 | Approximately **15% of check-in days MUST be missing** per patient, in realistic runs of 1–4 consecutive days, not scattered at random. |
| SIM-7 | The generator MUST write two files: `data/synthetic_panel.csv` (the data) and `data/ground_truth.json` (each patient's planted triggers, lags, and effect sizes). |
| SIM-8 | The generator MUST accept a `--seed` argument and MUST be fully deterministic for a given seed. |

Target output: ~36,000 rows with a flare-positive rate between 6% and 12%. If the positive rate falls outside this range, tune the effect sizes — do not tune the threshold in [§8.1](#81-target-definition).

### 8.3 Training procedure

Located at `ml/train.py`.

| ID | Requirement |
|---|---|
| TR-1 | The train/test split MUST be **by patient ID**, not by row. Patients 1–160 train, 161–200 test. Row-level splitting leaks future information and will produce a falsely excellent score. |
| TR-2 | A `GroupKFold(n_splits=5)` grouped on patient ID MUST be used for hyperparameter selection. |
| TR-3 | The only hyperparameter to tune is `C` (inverse regularization strength), over `[0.01, 0.03, 0.1, 0.3, 1.0, 3.0]`. |
| TR-4 | Selection metric MUST be **average precision (area under the precision-recall curve)**, not accuracy and not ROC-AUC. The classes are imbalanced; accuracy is misleading here. |
| TR-5 | `class_weight='balanced'` MUST be set. |
| TR-6 | The decision threshold MUST be chosen to maximize precision subject to recall ≥ 0.35, and MUST be recorded in `model.json`. |
| TR-7 | Training MUST emit a report containing: PR curve, confusion matrix at the chosen threshold, the full coefficient table, and the trigger-recovery result from [§8.5](#85-validation-requirements). |

Acceptance criteria for the trained model:

- Average precision ≥ **0.30** on held-out patients (baseline rate is ~0.09, so this is roughly 3× lift)
- Precision ≥ **0.55** at the chosen threshold
- Recall ≥ **0.35** at the chosen threshold
- At least **60% of nonzero coefficients** correspond to variables actually planted in the simulator

If these are not met, the correct response is to improve the simulator's realism or the feature set — **not** to switch model families.

### 8.4 Why logistic regression

Recorded here so no agent or reviewer "improves" it:

1. **Interpretability is a product feature, not a compromise.** L1 coefficients *are* the trigger profile shown on the Insights screen. A gradient-boosted model would require a separate SHAP pipeline to produce the same screen.
2. **It deploys as 95 numbers.** Inference in the app is one dot product and one sigmoid — no ONNX runtime, no TensorFlow Lite, no server.
3. **L1 performs automatic feature selection**, which is exactly what "find this person's triggers" means.
4. **It cannot silently overfit in a way that's hard to detect**, unlike a deep model on ~30k rows.

### 8.5 Validation requirements

| ID | Requirement |
|---|---|
| VAL-1 | **Trigger recovery test.** For each held-out patient, compare the model's top-ranked features against `ground_truth.json`. Report precision@5. This is the headline result for the project writeup. |
| VAL-2 | **Leakage test.** Retrain with all `_lag` features removed but keeping `severity_baseline`. Performance should drop substantially. If it does not, the model is reading the answer from the baseline term. |
| VAL-3 | **Null test.** Retrain on data where the target column has been randomly shuffled. Average precision MUST fall to approximately the base rate. If it does not, there is a bug in the pipeline. |
| VAL-4 | **Temporal sanity check.** Confirm no feature at index `t` uses any data from `t+1` or later. |

### 8.6 `model.json` contract

Written by `ml/export.py`, read by the app at `app/assets/model.json`.

```json
{
  "schema_version": 1,
  "model_version": "1.0.0",
  "trained_at": "2026-09-15T00:00:00Z",
  "model_type": "logistic_regression_l1",
  "horizon_hours": 72,
  "min_days_required": 14,
  "threshold": 0.42,
  "intercept": -2.1436,
  "features": [
    {
      "name": "stress_lag7",
      "mean": 4.812,
      "std": 2.104,
      "coefficient": 0.3841,
      "label": "Stress, about a week ago",
      "direction": "increases"
    }
  ],
  "metrics": {
    "average_precision": 0.34,
    "precision_at_threshold": 0.61,
    "recall_at_threshold": 0.38,
    "n_train_patients": 160,
    "n_test_patients": 40
  }
}
```

Features with a coefficient of exactly `0.0` (zeroed by L1) MAY be omitted from the array to reduce file size. The app MUST treat any feature absent from the array as having a coefficient of zero.

The `label` field is authored by hand in `ml/labels.py` — a dictionary mapping feature names to human-readable strings. The app MUST use `label` for all display and MUST NOT construct display strings from `name`.

---

## 9. On-device scoring specification

### 9.1 Algorithm

Implemented in `app/src/ml/scorer.ts`. Pure function, no side effects, no I/O.

```ts
export function score(
  featureVector: Record<string, number | null>,
  model: Model
): ScoreResult {
  let z = model.intercept;
  const contributions: Contribution[] = [];

  for (const f of model.features) {
    const raw = featureVector[f.name] ?? f.mean;   // missing → training mean
    const std = f.std < 1e-8 ? 1 : f.std;
    const zScore = (raw - f.mean) / std;
    const contribution = f.coefficient * zScore;
    z += contribution;
    contributions.push({ name: f.name, label: f.label, contribution });
  }

  const probability = 1 / (1 + Math.exp(-z));
  return { probability, band: toBand(probability, model), contributions };
}
```

### 9.2 Interface

```ts
export interface ScoreResult {
  probability: number;          // 0..1
  band: RiskBand;
  contributions: Contribution[];  // unsorted; caller sorts
}

export interface Contribution {
  name: string;
  label: string;
  contribution: number;         // signed; positive raises risk
}
```

### 9.3 Top-contributor selection

For FR-4.4, sort `contributions` by descending `contribution` (signed, not absolute) and take the top 3 with `contribution > 0.05`. If fewer than 3 qualify, show only those that do. Never display a factor that is currently *lowering* risk as though it were a warning.

### 9.4 Risk bands

| Band | Condition | Display |
|---|---|---|
| `low` | `probability < threshold * 0.6` | "Low" — neutral color |
| `elevated` | `threshold * 0.6 ≤ probability < threshold` | "Elevated" — amber |
| `high` | `probability ≥ threshold` | "Higher than usual" — coral |

The app MUST show the band label prominently and the raw percentage only as secondary text. Never use red, never use alarm iconography, and never use the word "warning."

---

## 10. External integrations

### 10.1 Open-Meteo

**Verify all parameter names against `https://open-meteo.com/en/docs` before implementing.** Names below were correct at time of writing.

Weather — `https://api.open-meteo.com/v1/forecast`

```
latitude, longitude
daily = temperature_2m_mean, temperature_2m_min, temperature_2m_max,
        relative_humidity_2m_mean, dew_point_2m_mean, surface_pressure_mean,
        uv_index_max, precipitation_sum, wind_speed_10m_max
timezone = auto
past_days = 14
forecast_days = 3
```

Air quality — `https://air-quality-api.open-meteo.com/v1/air-quality`

```
latitude, longitude
hourly = pm2_5, pm10, ozone, alder_pollen, birch_pollen, grass_pollen, ragweed_pollen
timezone = auto
past_days = 14
forecast_days = 3
```

Hourly air quality values MUST be aggregated to daily means before storage. `pollen_total` is the sum of all available pollen species, treating missing species as 0.

Archive (simulator only) — `https://archive-api.open-meteo.com/v1/archive`, same daily parameters, with `start_date` and `end_date`.

Client requirements:

| ID | Requirement |
|---|---|
| API-1 | Requests MUST time out after 10 seconds. |
| API-2 | Failures MUST retry at most twice with exponential backoff (1s, 4s), then give up silently. |
| API-3 | The client MUST NOT issue more than 1 request per hour per endpoint. Enforce with a stored `fetched_at` timestamp. |
| API-4 | Responses MUST be validated against a schema before writing to the DB. Reject and log malformed responses rather than writing nulls. |

### 10.2 Health data

This is the **highest-risk integration** in the project. It requires an Expo development build (Expo Go will not work), and it needs platform-specific native configuration.

| ID | Requirement |
|---|---|
| HD-1 | Health integration MUST be behind a feature flag, defaulting to **off**. |
| HD-2 | The app MUST be fully functional and demoable with the flag off. Manual sleep entry in the check-in form is the fallback. |
| HD-3 | Requested read scopes are limited to: sleep analysis, resting heart rate, step count. Request nothing else. |
| HD-4 | Health data MUST be read at most once per day, for the trailing 14 days. |
| HD-5 | If `wearable.sleep_hours` and `checkin.sleep_hours` both exist for a date, the **wearable value wins** in the feature vector. |

**Build-order instruction to agents:** implement HD-2 first and confirm the whole app works without health data before writing any native health code. If this integration is not working by the end of M6, ship with the flag off.

---

## 11. Screen specifications

### 11.1 Screen inventory

| Route | Screen | Tab |
|---|---|---|
| `/onboarding` | Onboarding flow (modal stack) | — |
| `/` | Today | Tab 1 |
| `/checkin` | Daily check-in (modal) | — |
| `/risk-detail` | Risk explanation | — |
| `/insights` | Trigger profile | Tab 2 |
| `/history` | Calendar + day detail | Tab 3 |
| `/settings` | Settings | Tab 4 |

### 11.2 Today screen

**Contains:** greeting with date; risk gauge or data-collection progress; today's check-in CTA (or a completed state); the trailing 7-day severity sparkline; short-form disclaimer.

**States:**

| State | Condition | Display |
|---|---|---|
| Collecting | fewer than 14 check-in days | Progress ring "9 of 14 days", copy explaining why |
| Sparse | ≥14 days but >40% missing in last 14 | "Log a few more days to resume forecasting" |
| Ready | model produces a probability | Risk band, percentage, top 3 contributors |
| Logged | today's check-in exists | CTA replaced with checkmark and "edit" affordance |

**Acceptance criteria:**
- Risk gauge renders within 200ms of screen mount (scoring is synchronous and cheap; do not make it async)
- No network request is required to render the risk value
- Screen is fully functional in airplane mode after first environment fetch

### 11.3 Check-in screen

Single vertically scrolling form, grouped into four sections in this order: **Skin** (severity, itch), **Body** (sleep, stress, water, alcohol), **Food** (five diet toggles), **Events** (illness, sore throat, skin injury, new product, medication taken). Notes field last. Save button pinned to the bottom.

**Acceptance criteria:**
- A user who changes only the `severity` slider can save in 2 taps total
- All sliders pre-fill from yesterday's values; diet and event toggles always default to off
- Saving writes exactly one row and triggers a rescore
- The form retains state if the app is backgrounded mid-entry

### 11.4 Insights screen

Horizontal bar chart of the top 8 features by `|coefficient|`, bars colored by direction (raises risk / lowers risk), each labelled with `label` from `model.json`.

**Required copy, verbatim, above the chart:**

> These are patterns, not proven causes. A factor appearing here means it moved together with flares in the data — not that it caused them.

**Acceptance criteria:**
- Labels never render a raw feature name
- Tapping a bar opens a detail sheet with the factor's description and typical lag
- The screen renders correctly when the model has fewer than 8 nonzero coefficients

### 11.5 Design constraints

Follow the app's existing design tokens. Do not introduce a component library. Specific constraints:

- No red, no alarm icons, no exclamation marks anywhere in risk presentation
- Support both light and dark mode
- All interactive targets ≥ 44×44pt
- All text meets WCAG AA contrast
- Never depend on color alone to convey band — always pair with the text label

---

## 12. Repository structure

```
fleur/
├── README.md
├── REQUIREMENTS.md              # this document
├── ml/
│   ├── requirements.txt
│   ├── simulate.py              # M1: synthetic patient generator
│   ├── fetch_archive.py         # M1: Open-Meteo historical pull
│   ├── features.py              # M2: feature engineering (source of truth)
│   ├── train.py                 # M2: training + validation
│   ├── labels.py                # M3: feature name → human label map
│   ├── export.py                # M3: writes model.json
│   ├── validate.py              # M2: VAL-1..VAL-4
│   ├── data/                    # gitignored
│   │   ├── synthetic_panel.csv
│   │   └── ground_truth.json
│   └── out/
│       ├── model.json
│       ├── report.md
│       └── figures/
└── app/
    ├── app.json
    ├── package.json
    ├── tsconfig.json
    ├── assets/
    │   └── model.json           # copied from ml/out/
    ├── app/                     # expo-router routes
    │   ├── _layout.tsx
    │   ├── index.tsx            # Today
    │   ├── insights.tsx
    │   ├── history.tsx
    │   ├── settings.tsx
    │   ├── checkin.tsx
    │   ├── risk-detail.tsx
    │   └── onboarding/
    └── src/
        ├── db/
        │   ├── schema.ts
        │   ├── migrations.ts
        │   └── queries.ts
        ├── ml/
        │   ├── features.ts      # MUST mirror ml/features.py exactly
        │   ├── scorer.ts
        │   └── model.ts         # types for model.json
        ├── api/
        │   ├── openMeteo.ts
        │   └── health.ts
        ├── components/
        ├── hooks/
        ├── types/
        └── utils/
```

---

## 13. Safety, privacy & compliance

### 13.1 Regulatory position

Predicting disease progression can constitute a medical device claim under FDA and EU MDR rules. This project is a **student prototype and is not submitted for regulatory clearance**. Two consequences bind the implementation:

1. **No treatment recommendations.** The app MUST NOT suggest starting, stopping, or changing any medication, and MUST NOT recommend seeing or not seeing a doctor for a specific finding.
2. **Softened claim language.** User-facing copy MUST use "risk", "pattern", "association", and "may". It MUST NOT use "will", "predicts", "diagnosis", or "prevents."

### 13.2 Required disclaimer text

**Full form** — shown at onboarding, requiring explicit acceptance, and in Settings:

> Fleur is an experimental research prototype, not a medical device. It cannot diagnose, treat, or prevent any condition, and its predictions have not been clinically validated. Nothing here is medical advice. Always talk to a qualified healthcare professional about your psoriasis, and never change your treatment based on this app.

**Short form** — required on every screen that displays a risk value:

> Experimental. Not medical advice.

### 13.3 Privacy

| ID | Requirement |
|---|---|
| PRIV-1 | All health data MUST remain on the device. There is no backend and no analytics SDK. |
| PRIV-2 | The app MUST NOT transmit any user-entered data to any server, ever. The only outbound requests are to Open-Meteo, carrying latitude and longitude only. |
| PRIV-3 | Location MUST be rounded to 2 decimal places (~1km) before being sent to Open-Meteo. |
| PRIV-4 | "Delete all data" MUST drop and recreate all tables, and MUST clear any cached model state. |
| PRIV-5 | No crash reporting, telemetry, or third-party SDK that transmits data MAY be added. |

### 13.4 Ethical presentation

The Insights screen presents correlations. Users will read them as causes. Mitigations are mandatory:

- The copy in [§11.4](#114-insights-screen) is required verbatim
- Never rank a factor as "your #1 trigger" — use "most strongly associated"
- Where a factor is flagged, offer the **elimination test**: a structured 2-week protocol comparing severity with and without the factor. This is the single most scientifically honest feature in the app and SHOULD be implemented if time allows in M8.

---

## 14. Milestones & build order

| Milestone | Week | Exit criteria (all must pass) |
|---|---|---|
| **M0 — Spec** | 1 | Data dictionary finalized; flare definition agreed; wireframes drawn. No code. |
| **M1 — Simulator** | 2 | `simulate.py` produces `synthetic_panel.csv` (~36k rows) and `ground_truth.json`; flare rate between 6–12%; deterministic under a fixed seed. |
| **M2 — Model** | 3 | `train.py` meets all acceptance criteria in [§8.3](#83-training-procedure); VAL-1 through VAL-4 all pass. |
| **M3 — Export** | 4 | `model.json` exists and validates against [§8.6](#86-modeljson-contract); `labels.py` covers every nonzero feature; **parity test passes**. |
| **M4 — App shell** | 5 | Expo app runs on a physical device; SQLite schema created and migrating; four tabs navigable; onboarding completable. |
| **M5 — Check-in** | 5 | Check-in form saves and reads back correctly; backfill and edit work; 30-second completion verified by stopwatch. |
| **M6 — Integrations** | 6 | Open-Meteo data fetched, cached, and offline-readable; health data behind flag (may ship off). |
| **M7 — Risk & Insights** | 6 | Live risk value from real personal data on the Today screen; Insights chart rendering; all disclaimers present. |
| **M8 — Pilot & polish** | 7 | 3–5 external testers using the app for ≥5 days; top 3 usability issues fixed; CSV export working. |
| **M9 — Submission** | 8 | Demo video recorded; writeup complete; repository documented. |

### 14.1 Cut order under time pressure

Cut in this exact order. Do not improvise a different order.

1. Health/wearable integration → ship with the flag off, manual sleep entry only
2. History calendar heatmap → replace with a simple list
3. External pilot testers → self-test only
4. CSV export
5. Elimination-test feature

**Never cut:** the synthetic-data validation (M1–M2), the parity test, or the disclaimers. These are, respectively, what makes this a machine learning project, what makes it correct, and what makes it responsible.

---

## 15. Testing requirements

### 15.1 Parity test (blocking)

The single most important test in the project. `ml/features.py` and `app/src/ml/features.ts` are two implementations of the same specification and will drift.

| ID | Requirement |
|---|---|
| TEST-1 | `ml/export.py` MUST emit `ml/out/parity_fixtures.json`: 10 hand-picked input windows from the test set, each with its full 95-feature vector and final probability as computed in Python. |
| TEST-2 | A Jest test MUST load these fixtures, run the TypeScript implementation, and assert every feature and the final probability match to within `1e-6`. |
| TEST-3 | This test MUST run in CI and MUST block merge on failure. |
| TEST-4 | The fixtures MUST include at least 2 windows with missing days, to exercise the [§7.5](#75-missing-data-policy) policy. |

### 15.2 Other required tests

| Area | Requirement |
|---|---|
| Scorer | Unit tests for: all-mean input returns sigmoid(intercept); zero-variance feature contributes 0; missing feature falls back to mean |
| Feature engineering (TS) | Lag correctness at boundaries; forward-fill capped at 3 days; the 40% missing-data guard returns null |
| Database | Migration from empty; unique-per-date constraint; delete-all clears everything |
| API client | Rate limit enforced; malformed response rejected; timeout handled; offline read path works |
| Bands | Boundary values map to the correct band |

### 15.3 Manual test checklist

Run before submission:

- [ ] Fresh install → onboarding → 14 days of backfilled check-ins → risk appears
- [ ] Airplane mode: app opens, check-in saves, risk still computes
- [ ] Deny location → manual city entry works → environment data still fetches
- [ ] Deny health permission → app fully functional
- [ ] Delete all data → app returns to onboarding state
- [ ] Dark mode on every screen
- [ ] Disclaimer visible on Today, Risk Detail, and Insights

---

## 16. Conventions for agents

- **TypeScript:** `strict: true`. No `any`. No non-null assertion (`!`) except in tests.
- **Naming:** `snake_case` for all database columns and all ML feature names (both languages). `camelCase` for TypeScript variables and properties. The mapping between them lives in exactly one place: `app/src/db/queries.ts`.
- **Dates:** always `'YYYY-MM-DD'` strings in the user's local timezone. Never store or compare `Date` objects. Never use UTC for check-in dates — a check-in belongs to the user's local calendar day.
- **Numbers:** all severity-family fields are integers 0–10. `sleep_hours` and `alcohol_units` are the only user-entered floats.
- **Errors:** never swallow silently. Log to console with a `[fleur]` prefix and surface a non-blocking UI state.
- **Comments:** explain *why*, not *what*. Any deviation from this spec requires a `// SPEC-DEVIATION:` comment with a reason.
- **Dependencies:** do not add a package without justification in the PR description. The dependency budget for the app is 15 direct runtime dependencies.
- **Commits:** conventional commits (`feat:`, `fix:`, `test:`, `docs:`), scoped to a milestone where possible.

---

## 17. Open questions

Resolve these before or during M0. Each needs a human decision.

| # | Question | Default if undecided |
|---|---|---|
| 1 | Is the app name "Fleur" final? | Keep as working title |
| 2 | Single city or multi-location support if the user travels? | Single home location; recompute if GPS moves >100km |
| 3 | Should `severity` be a 0–10 slider or a 5-point pictorial scale? | 0–10 slider; revisit after pilot feedback |
| 4 | Does the challenge require open-source licensing? | MIT |
| 5 | Is there a demo-length limit for the submission video? | Assume 3 minutes |
| 6 | Should the elimination-test feature be in v1 scope? | No — M8 stretch goal |

---

## 18. Glossary

| Term | Meaning |
|---|---|
| **Flare** | A worsening episode. Operationally: max severity over the next 3 days ≥ 14-day baseline + 3 points |
| **Koebner phenomenon** | New psoriasis lesions appearing at sites of skin trauma |
| **Guttate psoriasis** | Small drop-shaped lesions, classically triggered by streptococcal infection |
| **Lag** | Days between a trigger occurring and its effect on severity |
| **PASI** | Psoriasis Area and Severity Index, the clinical gold-standard score. Referenced for context only; not implemented in v1 |
| **Parity test** | Test asserting the Python and TypeScript feature pipelines produce identical output |
| **L1 regularization** | Penalty that drives unhelpful coefficients to exactly zero, performing feature selection |
| **Average precision** | Area under the precision-recall curve; the primary metric for this imbalanced problem |
| **Population model** | A single model trained across all simulated patients, shipped to every user. Contrast with a per-user personalized model, which is out of scope for v1 |
