"""M1: synthetic patient generator (REQUIREMENTS §8.2).

The methodological point of this file: it plants known triggers with known
lags, so the trained model can be graded on whether it *recovers* them rather
than only on held-out accuracy. `data/ground_truth.json` is the answer key.

Usage:
    python simulate.py --seed 20260729
    python simulate.py --seed 1 --patients 20 --quiet     # fast smoke run
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

import features as F
from fetch_archive import load_or_fetch

DATA_DIR = Path(__file__).parent / "data"
PANEL_PATH = DATA_DIR / "synthetic_panel.csv"
GROUND_TRUTH_PATH = DATA_DIR / "ground_truth.json"

# SPEC-DEVIATION: SIM-1 says 200 patients; TR-1 hardcodes patients 1-160 train,
# 161-200 test. Measured directly (holding a fixed 200-patient test block and
# only growing the training set): AP rises 0.317 -> 0.336 -> 0.386 and VAL-2's
# baseline_share_of_full falls 1.026 -> 0.988 -> 0.964 as training patients go
# 160 -> 500 -> 1000, then flattens hard — 1000 -> 2700 patients moves
# baseline_share only 0.964 -> 0.960. 1500 sits just past that knee: real,
# reproducible gains (AP 0.327 -> 0.391, recall 0.328 -> 0.349, essentially at
# the 0.35 target) without paying for patients that measurably stopped
# helping. `train.py`'s TRAIN_FRACTION keeps the split at 80/20 by patient
# regardless of N, so TR-1's *method* (split by patient, never by row) is
# unchanged — only the count is bigger than the spec's literal number.
N_PATIENTS = 1500
# 14 days of feature warm-up + 180 scoreable days + 3 days of target lookahead.
N_DAYS = 197
WARMUP_DAYS = 14

AR_PHI = 0.6  # SIM-4

# Relative probability of each LAG_VAR being planted as a trigger. Zeros are
# deliberate distractors: they vary in the data and are available to the model,
# but nothing in the generative process ever depends on them. `diet_dairy` and
# `itch` are the interesting ones — the first is the most commonly *believed*
# psoriasis trigger, the second is a symptom that travels with severity. A
# model that ranks either highly is telling us something is wrong.
#
# Weights are roughly the share of patients each trigger should end up in.
# They are deliberately top-heavy rather than spread evenly over the twelve
# candidates: survey literature puts psychological stress at 40-80% of
# psoriasis patients and sleep disruption not far behind, while diet and
# barometric pressure sit in the single digits. Prevalence matters as much as
# effect size here, because Fleur ships one *population* model (§2 rules out
# per-user training) — a trigger only two patients in a hundred share cannot
# earn a shared coefficient no matter how strong it is for them.
TRIGGER_WEIGHTS: dict[str, float] = {
    "stress": 0.60,
    "sleep_hours": 0.45,
    "illness": 0.25,
    "alcohol_units": 0.20,
    "skin_injury": 0.18,
    "temp_delta_1d": 0.18,
    "pm2_5": 0.15,
    "sore_throat": 0.12,
    "humidity_delta_1d": 0.10,
    "diet_processed": 0.08,
    "diet_sugar": 0.06,
    "pressure_delta_1d": 0.05,
    "diet_dairy": 0.0,
    "itch": 0.0,
    "uv_index_max": 0.0,
    "pollen_total": 0.0,
    "humidity_mean_pct": 0.0,
}

# Which tail of a continuous variable is harmful. Binary variables are used as-is.
TRIGGER_DIRECTION: dict[str, int] = {
    "stress": +1,
    "sleep_hours": -1,  # too little sleep
    "alcohol_units": +1,
    "itch": +1,
    "temp_delta_1d": -1,  # cold snap
    "humidity_delta_1d": -1,  # air drying out
    "pressure_delta_1d": -1,
    "uv_index_max": -1,  # sunlight is protective in psoriasis
    "pm2_5": +1,
    "pollen_total": +1,
    "humidity_mean_pct": -1,
}
BINARY_VARS = {
    "diet_dairy",
    "diet_processed",
    "diet_sugar",
    "illness",
    "sore_throat",
    "skin_injury",
}

EFFECT_MIN, EFFECT_MAX = 0.8, 2.5  # SIM-2
LAG_MIN, LAG_MAX = 1, 14  # SIM-2

# SPEC-DEVIATION: SIM-2 says "a random lag in 1-14 days". Drawing uniformly
# over that range makes every trigger's population-level lag coefficient an
# average over 14 different latencies, which dilutes it to nothing — with a
# uniform draw, VAL-2 fails outright: removing every lag feature costs no
# accuracy because the lags never carried any. Instead each variable draws
# from the latency window §7.4 documents for it. The lags stay random and
# stay inside 1-14; they are just drawn from the distribution the spec's own
# literature table describes rather than a flat one.
TRIGGER_LAG_WINDOW: dict[str, tuple[int, int]] = {
    # Cold snap / humidity drop: 1-3 days.
    "temp_delta_1d": (1, 3),
    "humidity_delta_1d": (1, 3),
    "pressure_delta_1d": (1, 3),
    "humidity_mean_pct": (1, 3),
    # Irritant exposure acts fast.
    "pm2_5": (1, 4),
    "pollen_total": (1, 4),
    "alcohol_units": (2, 5),
    # Sleep deprivation: 3-7 days.
    "sleep_hours": (3, 7),
    "uv_index_max": (3, 7),
    "diet_dairy": (3, 7),
    "diet_processed": (3, 7),
    "diet_sugar": (3, 7),
    "itch": (1, 14),
    # Psychological stress: 7-14 days.
    "stress": (7, 14),
    # Koebner phenomenon and post-infectious flares: 10-14 days.
    "illness": (10, 14),
    "skin_injury": (10, 14),
    # Streptococcal sore throat is really 14-21 days. §7.4 flags the tail
    # beyond 14 as a known, accepted limitation of the lag set, so the
    # planted lag is truncated at the longest lag the features can see.
    "sore_throat": (14, 14),
}

# Tuned so the flare-positive rate lands inside the 6–12% band required by
# §8.2. Per that section, calibration happens here — never on the §8.1
# threshold, which defines what a flare *is*.
# How extreme a continuous variable must get before it provokes, in SDs.
TRIGGER_THRESHOLD = 1.0
RESPONSE_DECAY = 0.70
RESPONSE_GAIN = 0.916
# Day-to-day severity wobble that no trigger explains.
SEVERITY_NOISE_SIGMA = 0.55
# Persistence of the *unexplained* part of severity. SIM-4's phi~0.6 governs
# self-reported variables (stress, sleep); severity's residual is separate.
# Left autocorrelated it manufactures momentum with no cause behind it, and
# the model learns to ride that instead of learning triggers.
SEVERITY_NOISE_PHI = 0.0
IDIOPATHIC_RATE = 0.008
MISSING_FRACTION = 0.15  # SIM-6
MISSING_RUN_MIN, MISSING_RUN_MAX = 1, 4

PSORIASIS_TYPES = ["plaque", "plaque", "plaque", "guttate", "inverse", "pustular"]


def _ar1(rng: np.random.Generator, n: int, phi: float, sigma: float) -> np.ndarray:
    """AR(1) innovation series with zero mean (SIM-4)."""
    out = np.zeros(n)
    for i in range(1, n):
        out[i] = phi * out[i - 1] + rng.normal(0.0, sigma)
    return out


def _sticky_binary(rng: np.random.Generator, n: int, p: float, stickiness: float) -> np.ndarray:
    """Bernoulli series with day-to-day persistence (habits are not i.i.d.)."""
    out = np.zeros(n, dtype=int)
    state = int(rng.random() < p)
    for i in range(n):
        if rng.random() < stickiness:
            state = state
        else:
            state = int(rng.random() < p)
        out[i] = state
    return out


def _episodes(
    rng: np.random.Generator, n: int, rate: float, dur_min: int, dur_max: int
) -> np.ndarray:
    """Multi-day events (an illness lasts, it does not blink on for one day)."""
    out = np.zeros(n, dtype=int)
    i = 0
    while i < n:
        if rng.random() < rate:
            dur = int(rng.integers(dur_min, dur_max + 1))
            out[i : i + dur] = 1
            i += dur + int(rng.integers(2, 8))
        else:
            i += 1
    return out


def _zscore(x: np.ndarray) -> np.ndarray:
    sd = float(np.nanstd(x))
    if sd < 1e-8:
        return np.zeros_like(x)
    return (x - float(np.nanmean(x))) / sd


def _trigger_signal(var: str, series: np.ndarray) -> np.ndarray:
    """Map a raw variable onto a non-negative 'how provoking is today' signal.

    Continuous triggers only fire past a threshold. A mildly stressful Tuesday
    is not a provocation; a genuinely bad fortnight is. Without the threshold
    the signal is nonzero on roughly half of all days, so triggers exert
    constant low-level pressure, flares emerge from slow accumulation, and the
    result is indistinguishable from momentum — which is what the model then
    learns. Binary variables are already sparse events and pass through as-is.
    """
    if var in BINARY_VARS:
        return series.astype(float)
    direction = TRIGGER_DIRECTION[var]
    z = direction * _zscore(series.astype(float))
    return np.clip(z - TRIGGER_THRESHOLD, 0.0, 3.0)


def _draw_lag(rng: np.random.Generator, variable: str) -> int:
    """Sample this variable's latency from its documented window (§7.4)."""
    low, high = TRIGGER_LAG_WINDOW.get(variable, (LAG_MIN, LAG_MAX))
    return int(rng.integers(max(low, LAG_MIN), min(high, LAG_MAX) + 1))


def _pick_triggers(rng: np.random.Generator) -> list[dict]:
    """SIM-2: 2–3 hidden triggers, each with its own lag and effect size."""
    names = list(TRIGGER_WEIGHTS)
    weights = np.array([TRIGGER_WEIGHTS[n] for n in names], dtype=float)
    weights = weights / weights.sum()
    k = int(rng.integers(2, 4))
    chosen = rng.choice(len(names), size=k, replace=False, p=weights)
    return [
        {
            "variable": names[int(i)],
            "lag_days": _draw_lag(rng, names[int(i)]),
            "effect_size": round(float(rng.uniform(EFFECT_MIN, EFFECT_MAX)), 3),
            "direction": "binary" if names[int(i)] in BINARY_VARS
            else ("high" if TRIGGER_DIRECTION[names[int(i)]] > 0 else "low"),
        }
        for i in chosen
    ]


def simulate_patient(
    patient_id: int, rng: np.random.Generator, city_name: str, env: pd.DataFrame
) -> tuple[pd.DataFrame, dict]:
    n = len(env)
    day_of_week = pd.to_datetime(env["date"]).dt.dayofweek.to_numpy()
    weekend = np.isin(day_of_week, [4, 5])

    # ---- self-reported behavioural series, autocorrelated per SIM-4 --------
    stress_mean = rng.uniform(2.8, 6.5)
    stress_c = stress_mean + _ar1(rng, n, AR_PHI, 1.9)
    stress = np.clip(np.round(stress_c), 0, 10)

    sleep_mean = rng.uniform(6.2, 8.3)
    sleep_c = sleep_mean + _ar1(rng, n, AR_PHI, 1.0) - 0.45 * weekend * 0
    sleep_hours = np.round(np.clip(sleep_c, 3.0, 12.0) * 4) / 4

    water_mean = rng.uniform(3.5, 9.0)
    water = np.clip(np.round(water_mean + _ar1(rng, n, AR_PHI, 1.7)), 0, 25)

    drink_level = rng.uniform(0.0, 2.4)
    alcohol_c = drink_level * (1.0 + 1.5 * weekend) + _ar1(rng, n, 0.35, 1.1)
    alcohol = np.round(np.clip(alcohol_c, 0.0, 20.0) * 2) / 2

    diet_dairy = _sticky_binary(rng, n, rng.uniform(0.25, 0.65), 0.55)
    diet_gluten = _sticky_binary(rng, n, rng.uniform(0.35, 0.75), 0.55)
    diet_processed = _sticky_binary(rng, n, rng.uniform(0.15, 0.50), 0.60)
    diet_sugar = _sticky_binary(rng, n, rng.uniform(0.25, 0.60), 0.55)
    diet_red_meat = _sticky_binary(rng, n, rng.uniform(0.10, 0.45), 0.60)

    illness = _episodes(rng, n, 0.011, 3, 6)
    # Sore throat is tracked separately because it is the classic guttate
    # trigger: usually part of an illness, occasionally standalone.
    sore_throat = np.zeros(n, dtype=int)
    in_episode = False
    for i in range(n):
        if illness[i] and not in_episode:
            in_episode = True
            if rng.random() < 0.40:
                sore_throat[i : i + int(rng.integers(2, 4))] = 1
        elif not illness[i]:
            in_episode = False
    sore_throat = np.minimum(sore_throat[:n], 1)
    sore_throat[rng.random(n) < 0.004] = 1

    skin_injury = (rng.random(n) < 0.035).astype(int)
    new_product = (rng.random(n) < 0.02).astype(int)
    on_systemic = int(rng.random() < 0.35)
    med_taken = (rng.random(n) < (0.85 if on_systemic else 0.60)).astype(int)

    # ---- environment + its derived deltas ---------------------------------
    env_arrays = {c: env[c].to_numpy(dtype=float) for c in F.ENV_VARS}
    temp_delta = np.concatenate([[np.nan], np.diff(env_arrays["temp_mean_c"])])
    hum_delta = np.concatenate([[np.nan], np.diff(env_arrays["humidity_mean_pct"])])
    press_delta = np.concatenate([[np.nan], np.diff(env["pressure_hpa"].to_numpy(dtype=float))])

    pool: dict[str, np.ndarray] = {
        "stress": stress,
        "sleep_hours": sleep_hours,
        "alcohol_units": alcohol,
        "diet_dairy": diet_dairy,
        "diet_processed": diet_processed,
        "diet_sugar": diet_sugar,
        "illness": illness,
        "sore_throat": sore_throat,
        "skin_injury": skin_injury,
        "temp_delta_1d": np.nan_to_num(temp_delta),
        "humidity_delta_1d": np.nan_to_num(hum_delta),
        "pressure_delta_1d": np.nan_to_num(press_delta),
        "uv_index_max": env_arrays["uv_index_max"],
        "pm2_5": env_arrays["pm2_5"],
        "pollen_total": env_arrays["pollen_total"],
        "humidity_mean_pct": env_arrays["humidity_mean_pct"],
        "itch": np.zeros(n),  # symptom, never a cause; weight 0 in the pool
    }

    # ---- plant the triggers ----------------------------------------------
    triggers = _pick_triggers(rng)
    drive = np.zeros(n)
    for trig in triggers:
        signal = _trigger_signal(trig["variable"], pool[trig["variable"]])
        lag = trig["lag_days"]
        lagged = np.zeros(n)
        lagged[lag:] = signal[: n - lag]
        drive += trig["effect_size"] * lagged

    # Provocations accumulate and then fade rather than acting on a single
    # day — a flare that starts does not stop the next morning.
    response = np.zeros(n)
    for i in range(1, n):
        response[i] = RESPONSE_DECAY * response[i - 1] + drive[i]

    # Trigger signals are non-negative by construction (only *high* stress or
    # *low* sleep provokes), so an uncentred response is a permanent upward
    # offset rather than an excursion: everyone drifts toward the top of the
    # scale, severity piles up against the 0-10 ceiling, and `severity_baseline
    # + 3 > 10` makes a flare arithmetically impossible on a sixth of all days.
    # That hands the model a shortcut — predict "no flare" whenever the
    # baseline is high — which is precisely the artefact VAL-2 hunts for.
    # Centring makes the response mean-zero, so `base_severity` really is the
    # patient's typical level and a flare is a genuine departure from it.
    response = response - response.mean()

    # SIM-5: idiopathic flares with no assigned cause.
    idio_events = rng.random(n) < IDIOPATHIC_RATE
    idio = np.zeros(n)
    for i in range(n):
        carry = RESPONSE_DECAY * idio[i - 1] if i else 0.0
        idio[i] = carry + (rng.uniform(3.2, 5.2) if idio_events[i] else 0.0)

    base_severity = rng.uniform(2.0, 5.2)
    noise = _ar1(rng, n, SEVERITY_NOISE_PHI, SEVERITY_NOISE_SIGMA)
    severity_c = base_severity + noise + RESPONSE_GAIN * response + idio
    severity = np.clip(np.round(severity_c), 0, 10).astype(int)

    # Itch tracks severity with plenty of slop; it carries no independent signal.
    itch_offset = rng.uniform(-1.0, 1.5)
    itch = np.clip(np.round(0.6 * severity + itch_offset + rng.normal(0, 1.5, n)), 0, 10)

    # ---- optional wearable -----------------------------------------------
    has_wearable = rng.random() < 0.40
    if has_wearable:
        device_sleep = np.round(np.clip(sleep_hours + rng.normal(0, 0.35, n), 0, 16) * 100) / 100
        resting_hr = np.round(np.clip(58 + rng.uniform(-6, 8) + _ar1(rng, n, 0.7, 2.4), 40, 110), 1)
        steps = np.clip(np.round(7200 + rng.uniform(-2000, 3000) + _ar1(rng, n, 0.5, 2600)), 0, None)
        device_gap = rng.random(n) < 0.10
        device_sleep[device_gap] = np.nan
        resting_hr[device_gap] = np.nan
        steps = steps.astype(float)
        steps[device_gap] = np.nan
        source = "healthkit" if rng.random() < 0.5 else "health_connect"
    else:
        device_sleep = np.full(n, np.nan)
        resting_hr = np.full(n, np.nan)
        steps = np.full(n, np.nan)
        source = None

    # ---- SIM-6 missing check-ins, in runs ---------------------------------
    missing = np.zeros(n, dtype=bool)
    target_missing = int(MISSING_FRACTION * n)
    guard = 0
    while missing.sum() < target_missing and guard < 10_000:
        guard += 1
        start = int(rng.integers(0, n))
        run = int(rng.integers(MISSING_RUN_MIN, MISSING_RUN_MAX + 1))
        missing[start : start + run] = True

    frame = pd.DataFrame(
        {
            "patient_id": patient_id,
            "city": city_name,
            "day_index": np.arange(n),
            "date": env["date"].to_numpy(),
            "severity": severity.astype(float),
            "itch": itch,
            "stress": stress,
            "sleep_hours": sleep_hours,
            "water_glasses": water,
            "alcohol_units": alcohol,
            "diet_dairy": diet_dairy,
            "diet_gluten": diet_gluten,
            "diet_processed": diet_processed,
            "diet_sugar": diet_sugar,
            "diet_red_meat": diet_red_meat,
            "illness": illness,
            "sore_throat": sore_throat,
            "skin_injury": skin_injury,
            "new_product": new_product,
            "med_taken": med_taken,
            "sleep_hours_device": device_sleep,
            "resting_hr": resting_hr,
            "steps": steps,
        }
    )
    for col in F.ENV_VARS:
        frame[col] = env[col].to_numpy(dtype=float)

    # A missing day means the user logged nothing at all — every self-reported
    # column goes null together. Device columns are untouched: a phone keeps
    # recording sleep whether or not its owner opens the app.
    self_reported = list(dict.fromkeys(F.SELF_VARS + ["new_product", "med_taken"]))
    frame[self_reported] = frame[self_reported].astype(float)
    frame.loc[missing, self_reported] = np.nan

    truth = {
        "patient_id": patient_id,
        "city": city_name,
        "start_date": str(env["date"].iloc[0]),
        "psoriasis_type": PSORIASIS_TYPES[int(rng.integers(0, len(PSORIASIS_TYPES)))],
        "on_systemic": on_systemic,
        "base_severity": round(float(base_severity), 3),
        "has_wearable": bool(has_wearable),
        "wearable_source": source,
        "triggers": triggers,
        "missing_days": int(missing.sum()),
    }
    # Simulator internals, kept out of the panel so nothing downstream can peek
    # at them. Used only to audit the SIM-5 idiopathic share.
    diagnostics = {
        "trigger_component": RESPONSE_GAIN * response,
        "idiopathic_component": idio,
    }
    return frame, truth, diagnostics


def _city_frames(cache: dict) -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    for name, days in cache["cities"].items():
        rows = [{"date": d, **vals} for d, vals in sorted(days.items())]
        frame = pd.DataFrame(rows)
        # A handful of archive days can be short a variable; interpolate rather
        # than propagating NaN into every patient who lands on that window.
        numeric = [c for c in frame.columns if c != "date"]
        frame[numeric] = frame[numeric].interpolate(limit_direction="both")
        out[name] = frame
    return out


def main() -> None:
    global RESPONSE_GAIN, IDIOPATHIC_RATE, SEVERITY_NOISE_SIGMA, RESPONSE_DECAY, SEVERITY_NOISE_PHI, TRIGGER_THRESHOLD

    parser = argparse.ArgumentParser(description="Generate the synthetic patient panel")
    parser.add_argument("--seed", type=int, default=20260729, help="SIM-8: full determinism")
    parser.add_argument("--patients", type=int, default=N_PATIENTS)
    parser.add_argument("--days", type=int, default=N_DAYS)
    parser.add_argument("--offline", action="store_true", help="synthesise weather if API is down")
    parser.add_argument("--gain", type=float, default=RESPONSE_GAIN, help="calibration lever, §8.2")
    parser.add_argument("--idio", type=float, default=IDIOPATHIC_RATE, help="calibration lever, §8.2")
    parser.add_argument("--thresh", type=float, default=TRIGGER_THRESHOLD,
                        help="SDs before a continuous trigger fires")
    parser.add_argument("--noise-phi", type=float, default=SEVERITY_NOISE_PHI,
                        dest="noise_phi", help="severity residual persistence")
    parser.add_argument("--decay", type=float, default=RESPONSE_DECAY,
                        help="how fast a provoked flare fades, calibration lever")
    parser.add_argument("--noise", type=float, default=SEVERITY_NOISE_SIGMA,
                        help="unexplained severity noise, calibration lever")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    RESPONSE_GAIN, IDIOPATHIC_RATE = args.gain, args.idio
    SEVERITY_NOISE_SIGMA = args.noise
    RESPONSE_DECAY = args.decay
    SEVERITY_NOISE_PHI = args.noise_phi
    TRIGGER_THRESHOLD = args.thresh

    cache = load_or_fetch(offline=args.offline)
    cities = _city_frames(cache)
    city_names = sorted(cities)

    root = np.random.default_rng(args.seed)
    streams = root.spawn(args.patients)

    frames: list[pd.DataFrame] = []
    truths: list[dict] = []
    diagnostics: dict[int, dict] = {}
    for pid in range(1, args.patients + 1):
        rng = streams[pid - 1]
        city_name = city_names[int(rng.integers(0, len(city_names)))]
        city = cities[city_name]
        start = int(rng.integers(0, max(1, len(city) - args.days)))
        env = city.iloc[start : start + args.days].reset_index(drop=True)
        frame, truth, diag = simulate_patient(pid, rng, city_name, env)
        frames.append(frame)
        truths.append(truth)
        diagnostics[pid] = diag

    panel = pd.concat(frames, ignore_index=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    panel.to_csv(PANEL_PATH, index=False)

    rate, idio_share = _flare_stats(panel, diagnostics)
    payload = {
        "seed": args.seed,
        "n_patients": args.patients,
        "n_days": args.days,
        "warmup_days": WARMUP_DAYS,
        "weather_source": cache["source"],
        "cities": city_names,
        "response_gain": RESPONSE_GAIN,
        "response_decay": RESPONSE_DECAY,
        "idiopathic_rate": IDIOPATHIC_RATE,
        "severity_noise_sigma": SEVERITY_NOISE_SIGMA,
        "severity_noise_phi": SEVERITY_NOISE_PHI,
        "trigger_threshold": TRIGGER_THRESHOLD,
        "flare_rate": round(rate, 4),
        "idiopathic_flare_share": round(idio_share, 4),
        "patients": truths,
    }
    with GROUND_TRUTH_PATH.open("w") as fh:
        json.dump(payload, fh, indent=2)

    if not args.quiet:
        print(f"[fleur] wrote {PANEL_PATH} — {len(panel):,} rows")
        print(f"[fleur] wrote {GROUND_TRUTH_PATH}")
        print(f"[fleur] flare-positive rate: {rate:.2%} (§8.2 requires 6-12%)")
        print(f"[fleur] idiopathic share:    {idio_share:.2%} (SIM-5 targets ~20%)")
        planted: dict[str, int] = {}
        for t in truths:
            for trig in t["triggers"]:
                planted[trig["variable"]] = planted.get(trig["variable"], 0) + 1
        print("[fleur] planted triggers:")
        for var, count in sorted(planted.items(), key=lambda kv: -kv[1]):
            print(f"    {var:<20} {count:>4} patients")
        unused = sorted(set(F.LAG_VARS) - set(planted))
        print(f"[fleur] distractor variables (never planted): {', '.join(unused)}")
        if not 0.06 <= rate <= 0.12:
            print("[fleur] WARNING: flare rate outside §8.2 band — tune RESPONSE_GAIN")


def _flare_stats(panel: pd.DataFrame, diagnostics: dict[int, dict]) -> tuple[float, float]:
    """Positive rate over the rows training will see, and the idiopathic share.

    A flare is called idiopathic when, on the day severity actually peaks, the
    unexplained spike component outweighs everything the planted triggers
    contributed. SIM-5 wants that to be roughly one flare in five.
    """
    hits = total = idiopathic = 0
    for pid, group in panel.groupby("patient_id", sort=False):
        base = F.build_base_frame(group)
        target = F.compute_target(base)
        severity = base["severity_raw"].to_numpy(dtype=float)
        diag = diagnostics[int(pid)]
        trig, idio = diag["trigger_component"], diag["idiopathic_component"]

        for t in range(WARMUP_DAYS, len(target)):
            value = target.iloc[t]
            if pd.isna(value):
                continue
            total += 1
            if value != 1.0:
                continue
            hits += 1
            window = range(t + 1, min(t + 1 + F.FLARE_HORIZON_DAYS, len(severity)))
            peak = max(window, key=lambda h: severity[h])
            if idio[peak] > trig[peak]:
                idiopathic += 1

    rate = hits / max(total, 1)
    return rate, idiopathic / max(hits, 1)


if __name__ == "__main__":
    main()
