# Fleur Flare-Risk Model — Design Reference

This document covers `ml/` (the training pipeline) and its counterpart
`app/src/ml/` (the on-device runtime): what the system does, how it's built,
and how it behaves in production. It moves from a high-level summary down to
exact formulas — read as far as the level of detail you need.

> **Status note.** The panel size was increased from 200 to 1500 simulated
> patients (see §3.1). All numbers in this document reflect that current
> N=1500 training run (`ml/out/metrics.json`, `ml/out/report.md`,
> `ml/out/trained.npz`). `python export.py` has since been re-run:
> `ml/out/model.json` and `app/assets/model.json` are both current, the
> parity fixtures were regenerated and re-verified (42/42 passing at 1e-6),
> and the full app test suite (130 tests) and `tsc --noEmit` are clean
> against this model. §7.2's parameters match the shipped file exactly, not
> a preview of it.

---

## 1. Summary

Fleur predicts whether a psoriasis patient is likely to have a **flare** — a
meaningful worsening of skin severity — in the next 72 hours. The prediction
is produced by a single, deliberately simple statistical model (L1-regularized
logistic regression, §5.1) trained on **simulated** patient data, since no
real patient data exists yet. The model examines up to 95 numeric signals
derived from a person's recent check-ins, weather, and (optionally) wearable
data, and combines them into one probability. Training happens offline; the
result — a JSON file of roughly 40-70 numbers — ships inside the mobile app
and is evaluated entirely on-device, with no server round-trip.

---

## 2. Pipeline overview

Three scripts run in sequence, each producing the inputs to the next:

```
 1. SIMULATE                2. TRAIN                    3. EXPORT
 ┌────────────────┐        ┌──────────────────────┐    ┌─────────────────────┐
 │ simulate.py     │──────▶│ features.py           │──▶│ export.py            │
 │                 │       │ train.py               │   │                     │
 │ generates fake  │       │ validate.py            │   │ writes model.json   │
 │ patient panel   │       │                         │   │ + parity fixtures   │
 └────────────────┘        │ writes trained.npz,     │   └──────────┬──────────┘
        │                  │ metrics.json, report.md │              │
        ▼                  └──────────────────────┘              ▼
 data/synthetic_                                     app/assets/model.json
 panel.csv                                                        │
 data/ground_truth.json                                           ▼
                                                     app/src/ml/scorer.ts
                                                     (runs on-device)
```

```bash
python simulate.py    # generate the simulated patient panel
python train.py       # fit and validate the model
python export.py      # package the model for the app
```

### 2.1 File map

| File | Role |
|---|---|
| `ml/simulate.py` | Generates the simulated patient panel and its answer key. |
| `ml/data/synthetic_panel.csv` | The simulated training data — one row per patient per day. |
| `ml/data/ground_truth.json` | The planted-trigger answer key, used only for grading, never for training. |
| `ml/features.py` | Source of truth for feature engineering (95 inputs). `app/src/ml/features.ts` is a hand-maintained TypeScript mirror, kept in sync by a blocking parity test. |
| `ml/train.py` | Fits the model and runs the acceptance checks. Entry point: `python train.py`. |
| `ml/validate.py` | The four validation checks (VAL-1..VAL-4), imported by `train.py`. |
| `ml/out/trained.npz` | Raw fitted parameters (NumPy binary) — an intermediate artifact, not consumed by the app. |
| `ml/out/metrics.json` | Machine-readable accuracy and validation results. |
| `ml/out/report.md` | Human-readable rendering of the same results. |
| `ml/export.py` | Packages `trained.npz` into the shipped model. Entry point: `python export.py`. |
| `ml/out/model.json` | The shipped model artifact — the actual output the app consumes. |
| `app/assets/model.json` | Bundled copy of `ml/out/model.json`, packaged into the mobile app. |
| `app/src/ml/model.ts` | TypeScript types for `model.json`. |
| `app/src/ml/scorer.ts` | On-device scoring — a TypeScript twin of `export.py`'s reference scoring function. |
| `app/src/ml/risk.ts` | Decides what the Today screen shows (not enough history / too sparse / a real score). |
| `app/src/hooks/appState.tsx` | Loads `assets/model.json` and triggers recomputation. |

---

## 3. Training data

### 3.1 Simulated patient generation

`ml/simulate.py` produces **1500 simulated patients**, each with 197 days of
daily records (14 days of feature warm-up, 180 scoreable days, 3 days of
target lookahead). This is a **spec deviation** from the original 200-patient
design: measured directly, average precision rises materially as training
patients scale from 160 → 500 → 1000, then flattens sharply beyond that —
1500 sits just past that knee, capturing most of the available gain (recall
moves from 0.328 to 0.349, essentially reaching the 0.35 acceptance target)
without training on patients that stopped measurably helping. The 80/20
train/test split is still applied **by patient**, not by row (§5.3) — the
method is unchanged, only the count.

Each simulated patient logs daily values across three sources:

- **Self-reported check-ins**: `severity` (0-10 skin severity), `itch`,
  `stress`, `sleep_hours`, `alcohol_units`, diet flags, `illness`,
  `sore_throat`, `skin_injury`, etc.
- **Environment**, pulled from a real weather archive for 8 cities:
  `temp_mean_c`, `humidity_mean_pct`, `uv_index_max`, `pm2_5` (air
  pollution), `pollen_total`, etc.
- **Wearable data** (~40% of patients, matching realistic adoption):
  `sleep_hours_device`, `resting_hr`, `steps`.

For each patient, the simulator secretly plants **2-3 triggers** — a
variable, a **lag** (the number of days between the provoking event and its
effect — e.g. "skin worsens 8 days after high stress"), and an effect size.
The rest of a patient's variables are either irrelevant noise or a
**distractor**: a variable that varies convincingly but is never wired into
the generative process as a cause. `diet_dairy` and `itch` are included
specifically as distractors — dairy is the most commonly *believed*
psoriasis trigger despite weak evidence, and itch merely tracks severity
after the fact rather than causing it. A trained model that weights either
one highly is a signal something in the pipeline is wrong, not a real
finding.

Trigger prevalence is deliberately uneven, reflecting survey literature
(stress and sleep disruption are common; diet and pressure triggers are
rare) and because Fleur ships one shared **population model** across all
users (§5.1) rather than a per-user model — a trigger only a handful of
patients share cannot earn a shared coefficient no matter how strong it is
for them. At N=1500, planted-trigger prevalence is:

| Trigger | Patients | Trigger | Patients |
|---|---|---|---|
| stress | 800 | pm2_5 | 246 |
| sleep_hours | 680 | sore_throat | 196 |
| illness | 396 | humidity_delta_1d | 150 |
| alcohol_units | 330 | diet_processed | 126 |
| temp_delta_1d | 309 | pressure_delta_1d | 94 |
| skin_injury | 299 | diet_sugar | 90 |

A provoked flare doesn't resolve the day after the trigger — it builds and
fades. This is modeled with an **exponential decay**: each day, the
"drive" from active triggers carries forward at 70% of its previous value
(`response[t] = 0.70 · response[t-1] + drive[t]`) before the new day's
triggers are added. In plain terms, 70% of yesterday's provocation is still
present today, 70% of *that* is present the day after, and so on — a smooth
rise and taper rather than a single-day spike. This constant
(`RESPONSE_DECAY`) is a simulator calibration lever, not something the model
learns; it exists only to make simulated flares behave like real ones.

The simulator also reproduces two properties real logging data would have:

- **Missing check-ins**: ~15% of days have no check-in, occurring in
  realistic multi-day runs rather than randomly scattered single days.
- **Idiopathic flares**: roughly 24% of planted flares have no traceable
  cause at all, matching real skin conditions — the model is not expected
  to explain every flare.

The full answer key — which trigger, what lag, what strength, per patient —
is written to `ml/data/ground_truth.json` and is never fed into training. It
exists solely to grade the trained model afterward (VAL-1, §6).

### 3.2 Target definition

A day `t` is labeled a **flare** if severity reaches at least 3 points above
that patient's own trailing 14-day baseline at any point in the next 3 days.
This is a per-patient, *relative* threshold — someone whose skin normally
sits at 2 flaring to 5 counts exactly as much as someone going from 6 to 9 —
rather than one fixed severity cutoff for the whole population. Rows where
the future window is incomplete, or where no baseline yet exists, are
**dropped**, never imputed: an unlabeled row is not treated as a negative
example.

At N=1500, this produces a flare-positive rate of **9.26%** (within the
required 6-12% band) with an idiopathic share of **23.85%** (target ~20%).

---

## 4. Feature engineering (`ml/features.py`)

Raw daily rows are expanded into 95 numeric **features** before training.
Three kinds:

- **Lag features** (`{var}_lag{1,3,7,14}`, 17 variables × 4 lags = 68
  features): the value of a variable a fixed number of days in the past —
  e.g. `stress_lag7` is literally the logged stress value exactly 7 days
  before the row being scored. Lags are what let the model account for
  delayed effects a same-day-only model would miss entirely.
- **Rolling features** (`{var}_roll{3,7,14}`, 7 variables × 3 windows = 21
  features): the trailing N-day average of a variable — e.g.
  `stress_roll14` smooths out day-to-day noise to capture sustained
  conditions rather than single-day blips.
- **Current-value features** (6 features): `severity_baseline`,
  `severity_delta` (today vs. baseline), `sleep_debt_7d`, and three raw
  weather levels.

Before any of this, `build_base_frame` joins the three data sources onto one
row per calendar date (missing dates are inserted as all-null rows so lags
count real calendar days, never row positions), forward-fills each variable
across gaps of at most 3 days, and computes derived variables (day-over-day
weather deltas, sleep debt against a 7.5h/night target, and the rolling
severity baseline).

Every feature is then **standardized**: converted to "how many standard
deviations from the training-set average is this," using that feature's
stored `mean` and `std`. This puts variables with very different natural
scales (stress 0-10, air pollution 0-50) on comparable footing so no
feature dominates purely because its raw numbers happen to be larger. A
missing input is filled with its own training-set mean before this step,
which standardizes to exactly 0 — i.e., a missing value is treated as
"assume typical, contribute nothing to the score," rather than causing an
error or a biased guess.

`app/src/ml/features.ts` is a hand-written TypeScript port of this file,
kept honest by a blocking Jest parity test that replays fixed windows
through both implementations and asserts identical output (§7.1).

---

## 5. Training (`ml/train.py`)

### 5.1 Model

Fleur fits **L1-regularized logistic regression** — one of the simplest
classification model types available. For a standardized feature vector `x`
with learned **coefficients** `β` and **intercept** `β₀`:

```
z = β₀ + β·x
P(flare within 72h) = 1 / (1 + e^-z)
```

Each **coefficient** is a single number the model learns per feature,
capturing how much — and in which direction — that feature moves risk, all
else held equal. A positive coefficient means more of that feature pushes
risk up; negative means it pushes risk down. The **intercept** is the
coefficient with no feature attached — the baseline log-odds before any of
today's specific data is applied.

This model type is a deliberate choice, not a starting point to be
"upgraded" later: a linear model with ~40-70 active features can be read
directly to see what it thinks matters, which matters more here than
squeezing out marginal accuracy with a more complex model that can't be
audited or explained to a user.

### 5.2 Regularization and hyperparameter tuning

`C` is a **hyperparameter** — a setting chosen before training that
controls *how* the model learns, as distinct from a coefficient, which the
model learns from data. `C` controls the strength of **L1 regularization**:
a penalty term added to the training objective equal to the sum of the
absolute values of every coefficient, scaled by `1/C`. Because the penalty
is on the absolute value (not the square, which would be L2/ridge), the
optimizer is pushed to set weak or redundant coefficients to *exactly*
zero rather than merely shrinking them — this is what performs automatic
feature selection. At N=1500, **71 of 95 candidate features survive**
(smaller `C` prunes more aggressively; larger `C` keeps more).

`C` itself is chosen by **5-fold grouped cross-validation**: the training
patients are split into 5 groups; for each candidate `C ∈ {0.01, 0.03, 0.1,
0.3, 1.0, 3.0}`, the model is trained on 4 groups and scored on the 5th,
rotated five times, and the five scores averaged. Grouping by patient
guarantees no one person's rows appear on both sides of a split. The
winning value is `C = 0.01` — the most aggressive pruning offered in the
grid (`ml/out/figures/c_sweep.png` plots the full sweep).

`class_weight="balanced"` additionally reweights the training objective so
the rare positive class (~9-10% of rows) and the common negative class
contribute equally — without this, the optimizer could get a deceptively
low loss just by predicting "no flare" almost always. This distorts the raw
fitted probabilities upward, so after fitting, the intercept is corrected
by the **log prior-odds** (`log(p / (1-p))` for the true training flare
rate `p`) — an algebraic correction that leaves the model's *ranking*
(and therefore its accuracy) unchanged while making the probability shown
to a user actually mean what it says.

### 5.3 Train/test split

Patients are split 80/20 into a training group and a held-out test group —
**by patient**, not by row. At N=1500: **1200 train patients / 300 test
patients** (148,418 / 37,410 scoreable rows). Splitting by row instead would
let the same patient's adjacent days land on both sides of the split,
producing an artificially good score by letting the model effectively see
answers it should not have access to.

### 5.4 Threshold selection

Once the final model is fit, every possible probability cutoff is evaluated
for precision and recall on cross-validation scores (never on the test set).
Among cutoffs achieving **recall ≥ 0.35**, the one with the highest
**precision** is kept as the model's **threshold** — the probability above
which a day is called "high risk." At N=1500, `threshold = 0.2215`. This is
not 0.5 by design: the model's probabilities run generally low (matching
the ~10% real-world base rate), and the threshold is calibrated to that,
not to a round number.

**Precision** is: of the days flagged high risk, what fraction actually
flared (few false alarms = high precision). **Recall** is: of the days that
actually flared, what fraction were caught (few misses = high recall). The
two trade off against each other; the threshold-selection rule above
resolves that tradeoff by prioritizing precision once a recall floor is met.

### 5.5 Results (N=1500 vs. prior N=200 run)

| Metric | N=200 (prior, unmodified spec defaults) | N=1500 (current) | §8.3 target |
|---|---|---|---|
| Average precision | 0.3271 | **0.3905** | ≥ 0.30 |
| Precision @ threshold | 0.3719 | **0.4529** | ≥ 0.55 |
| Recall @ threshold | 0.3285 | **0.3493** | ≥ 0.35 |
| ROC AUC | 0.7478 | 0.7630 | (reference only) |
| Base rate (test) | 0.0815 | 0.0990 | — |
| Lift over base rate | 4.01x | 3.94x | ~3x |
| Nonzero coefficients | 39 / 95 | 71 / 95 | — |

**Average precision** summarizes precision across every possible threshold
at once, and is the metric used to select `C`. **Lift over base rate**
(`average_precision / base_rate`) contextualizes that number against
"guess the population average every time" — the N=1500 model is now
~3.9x better than that baseline.

At N=1500, average precision and VAL-1 (§6) both clear their targets;
precision-at-threshold and recall-at-threshold have improved substantially
but have not yet cleared their §8.3 targets (0.4529 vs. 0.55, and 0.3493
vs. 0.35 — recall is now within a hair of target). Overall §8.3 acceptance
is **not yet fully met**, though materially closer than at N=200.

---

## 6. Validation (`ml/validate.py`)

Four checks decide whether the model is measuring something real, distinct
from the accuracy metrics above. `train.py` runs all four automatically.

**VAL-1 — trigger recovery.** Does the model's feature ranking line up with
the triggers actually planted in the simulator (`ground_truth.json`)? Of the
trigger-eligible variables the model assigns a nonzero weight to, what
fraction were ever real planted triggers for some patient? Passes at
`≥ 0.60`. **At N=1500: 0.7059 — PASS.**

**VAL-2 — leakage test.** The central "is this cheating" check. Severity
naturally has day-to-day momentum (a bad day is often followed by another),
so a model could score deceptively well by reading *recent severity alone*
and calling that a prediction, without the trigger-related features (lags,
rolling windows) contributing anything real — which would be close to
useless in practice, since it mostly restates what's already visible rather
than anticipating it. The test refits on `severity_baseline` +
`severity_delta` alone and compares that subset's test-set average precision
against the full model's. Passes if the baseline-only subset scores
`< 0.90×` the full model. **At N=1500: baseline-only scores 0.9565× the
full model — FAIL**, though this has improved from 1.028× at N=200 (the
severity-only subset used to *outscore* the full model; it no longer does,
but still hasn't fallen far enough below it).

**VAL-3 — null test.** Shuffle the training labels (destroying any real
signal) and refit. A model that still scores above the base rate on
*real* test labels indicates something upstream is leaking information it
shouldn't have access to. Passes if shuffled-label average precision stays
`< 1.35×` the test base rate. **At N=1500: ratio 0.8984 — PASS.**

**VAL-4 — temporal sanity.** An empirical proof that no feature at day `t`
ever reads data from `t+1` onward. All data after a fixed cutoff day is
corrupted (`x → 3x + 97`), the full feature matrix is rebuilt from both the
original and corrupted panels, and every feature value *before* the cutoff
is asserted numerically identical between the two runs. **PASS** (0 cells
differing; the post-cutoff corruption is separately confirmed to have
actually changed something, so the check itself is meaningful).

---

## 7. Model artifact

### 7.1 `model.json`

The trained model is packaged by `ml/export.py` into `ml/out/model.json` (a
copy is bundled at `app/assets/model.json`). This file — not any code — is
the actual output of training: a short list of features, each with a
coefficient, plus an intercept and a threshold. Structure:

```jsonc
{
  "schema_version": 1,
  "model_version": "1.0.0",
  "model_type": "logistic_regression_l1",
  "horizon_hours": 72,
  "min_days_required": 14,       // FR-4.2: no risk shown below this history
  "threshold": 0.2215,
  "intercept": -2.7192,
  "features": [
    {
      "name": "severity_delta",
      "mean": 0.024217,          // training-set mean, for standardizing
      "std": 1.38309,            // training-set std, for standardizing
      "coefficient": 0.85568,
      "label": "Today compared with your usual",  // pre-written display text
      "direction": "increases"
    },
    {
      "name": "severity_baseline",
      "mean": 3.706967, "std": 1.299157,
      "coefficient": -0.232221,
      "label": "Your usual severity lately",
      "direction": "decreases"
    },
    {
      "name": "stress_roll14",
      "mean": 4.696287, "std": 1.518356,
      "coefficient": 0.202882,
      "label": "Stress, averaged over the last 2 weeks",
      "direction": "increases"
    }
    // ... remaining features (71 total at N=1500), sorted by |coefficient|
  ],
  "metrics": {
    "average_precision": 0.3905,
    "precision_at_threshold": 0.4529,
    "recall_at_threshold": 0.3493,
    "base_rate": 0.0990,
    "n_train_patients": 1200,
    "n_test_patients": 300
  }
}
```

Values above are read directly from the current, shipped `ml/out/model.json`
(71 features total) — genuine N=1500 output, not illustrative numbers.
`app/assets/model.json` is the same file, verified against it via 42/42
passing parity-fixture assertions (1e-6 tolerance).

L1 regularization means many of the original 95 candidate features never
appear at all — anything absent from the `features` array is treated by
the app as having a coefficient of exactly zero (§7.2). `label` is
pre-written per feature in `ml/labels.py`; the app is required to display it
verbatim and forbidden from constructing display text from `name`, so
wording stays deliberately neutral (house style: "Stress, about a week ago,"
never "Stress spike triggered a flare").

A second file, `ml/out/parity_fixtures.json`, ships 10 example
input-windows-to-expected-output pairs, used purely to keep
`app/src/ml/scorer.ts` from silently drifting out of sync with the Python
reference scorer in `export.py`.

### 7.2 Scoring formula

Given a feature vector and the model above:

```
z = intercept
for each feature f in model.features:
    raw = vector[f.name] if present else f.mean     // missing → training mean
    z += f.coefficient × (raw - f.mean) / f.std
probability = 1 / (1 + e^-z)
```

Risk **bands** are then derived from `probability` relative to `threshold`:

| Band | Condition |
|---|---|
| low | `probability < threshold × 0.6` |
| elevated | `threshold × 0.6 ≤ probability < threshold` |
| high | `probability ≥ threshold` |

---

## 8. App integration (`app/src/ml/`)

1. **Loading.** `app/src/hooks/appState.tsx` imports `assets/model.json`
   directly as a bundled static asset at build time — no network request,
   no download; the whole file is on the order of tens of KB.

2. **Feature construction.** On any data change (a new check-in saved,
   etc.), `app/src/ml/features.ts` — the TypeScript mirror of
   `ml/features.py` — rebuilds the same 95-value feature vector from the
   user's last ~30 days of check-ins, weather, and wearable data.

3. **Predictability gate.** Before scoring, `app/src/ml/risk.ts` checks:
   - fewer than 14 distinct check-in days ever logged → `collecting`
     state, no score shown (FR-4.2);
   - enough history overall but more than 40% of the trailing 14 days
     missing a check-in → `sparse` state, no score shown (§7.5.3);
   - otherwise → proceed to scoring.

4. **Scoring.** `app/src/ml/scorer.ts` implements the formula in §7.2
   exactly, and additionally records each feature's signed contribution to
   `z`, so the UI can surface *why* a score is what it is.

5. **Explanation.** The top 3 positive contributors above a floor of 0.05
   are surfaced as "what's driving your risk" (`topContributors`); the
   top 3 negative contributors are surfaced separately as protective
   factors (`protectiveContributors`). Sorting is on the *signed*
   contribution, never the absolute value, so a risk-lowering factor is
   never presented as something to worry about.

All of the above is synchronous, on-device, and well under the 200ms budget
for the Today screen to render a risk value on mount (§11.2) — the entire
computation is a ~95-term dot product and one sigmoid evaluation.

---

## 9. Mathematical reference

### 9.1 Objective function

Training minimizes, over coefficients `β`:

```
-Σᵢ [yᵢ log(p̂ᵢ) + (1-yᵢ) log(1-p̂ᵢ)]   +   (1/C) · Σⱼ |βⱼ|
```

The first term is log loss (binary cross-entropy). The second is the L1
penalty described in §5.2. Fit via `scikit-learn`'s `liblinear` solver
(coordinate descent for L1-penalized linear models), with
`class_weight="balanced"`.

### 9.2 Standardization

For raw feature value `f`, training-set mean `μ`, training-set std `σ`:

```
x = (f - μ) / σ         (x = 0 if σ ≈ 0, i.e. a constant feature)
```

Missing `f` is imputed as `f = μ` before this step, making `x = 0` exactly.
`μ` and `σ` are fit only on the training fold in cross-validation, and only
on the full training set for the final model — never on validation or test
rows, to avoid leaking held-out information into the transform itself.

### 9.3 Prior-odds intercept correction

```
prior = mean(y_train)
shift = log(prior / (1 - prior))
intercept_final = intercept_fitted + shift
```

Undoes the distortion introduced by `class_weight="balanced"` without
changing the model's ranking (§5.2).

### 9.4 Target definition

For patient-day `t`, baseline `b_t` (14-day trailing mean severity), raw
severities `s`:

```
target(t) = 1  if max(s[t+1], s[t+2], s[t+3]) ≥ b_t + 3
target(t) = 0  otherwise
target(t) = NaN (row dropped)  if any of s[t+1..t+3] is missing, or b_t undefined
```

### 9.5 Evaluation metrics

- **Average precision**: `Σₙ (Rₙ - Rₙ₋₁) · Pₙ` over the sorted
  precision-recall operating points.
- **Precision @ threshold** = `TP / (TP + FP)`; **recall @ threshold** =
  `TP / (TP + FN)`, both at the single chosen threshold.
- **Lift over base rate** = `average_precision / base_rate`.

### 9.6 Validation checks, formally

- **VAL-1**: collapse each feature to its base variable by max |coefficient|
  across lag/roll variants; `selected_precision` = (# nonzero-ranked base
  variables that were ever a real planted trigger) / (# nonzero-ranked base
  variables). Pass at `≥ 0.60`.
- **VAL-2**: refit the same `C` on the `severity_baseline` +
  `severity_delta` subset only; compare its test-set average precision to
  the full model's. Pass if `< 0.90×`.
- **VAL-3**: shuffle training labels (fixed-seed RNG), refit, score against
  real test labels. Pass if resulting AP `< 1.35×` the test base rate.
- **VAL-4**: corrupt all raw values after a cutoff day (`x → 3x + 97`),
  rebuild the full feature matrix from both original and corrupted panels,
  assert every pre-cutoff feature value is identical (`np.isclose`,
  `atol=1e-12`) between the two.

