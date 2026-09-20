"""Feature engineering — SOURCE OF TRUTH (REQUIREMENTS §7).

`app/src/ml/features.ts` is a hand-written mirror of this module. The two are
kept honest by the blocking parity test (§15.1); when you change anything here,
change it there in the same commit and regenerate `out/parity_fixtures.json`.

Everything in this file is deliberately written in a form that is trivial to
re-express in TypeScript: no pandas-only idioms leak into the numeric
definitions, and every window rule is spelled out as an explicit constant.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# §7.1 Base variables
# --------------------------------------------------------------------------

# Self-reported, sourced from the `checkin` table.
SELF_VARS: list[str] = [
    "severity",
    "itch",
    "stress",
    "sleep_hours",
    "water_glasses",
    "alcohol_units",
    "diet_dairy",
    "diet_gluten",
    "diet_processed",
    "diet_sugar",
    "diet_red_meat",
    "illness",
    "sore_throat",
    "skin_injury",
]

# Environmental, sourced from the `environment` table.
ENV_VARS: list[str] = [
    "temp_mean_c",
    "humidity_mean_pct",
    "dew_point_c",
    "pressure_hpa",
    "uv_index_max",
    "precipitation_mm",
    "pm2_5",
    "pollen_total",
]

# Optional, sourced from the `wearable` table. `sleep_hours_device` overrides
# the self-reported `sleep_hours` (HD-5). `resting_hr` and `steps` are carried
# through the base frame but are not referenced by any of the 95 features —
# §7.3 does not list them in LAG_VARS, ROLL_VARS or CURRENT_VARS.
WEARABLE_VARS: list[str] = ["sleep_hours_device", "resting_hr", "steps"]

# §7.2 Derived, computed before lagging.
DERIVED_VARS: list[str] = [
    "temp_delta_1d",
    "humidity_delta_1d",
    "pressure_delta_1d",
    "sleep_debt_7d",
    "severity_baseline",
    "severity_delta",
]

BASE_VARS: list[str] = SELF_VARS + ENV_VARS + WEARABLE_VARS

# --------------------------------------------------------------------------
# §7.3 Lag and rolling specification
# --------------------------------------------------------------------------

LAG_VARS: list[str] = [
    "stress",
    "sleep_hours",
    "itch",
    "alcohol_units",
    "diet_dairy",
    "diet_processed",
    "diet_sugar",
    "illness",
    "sore_throat",
    "skin_injury",
    "temp_delta_1d",
    "humidity_delta_1d",
    "pressure_delta_1d",
    "uv_index_max",
    "pm2_5",
    "pollen_total",
    "humidity_mean_pct",
]
LAGS: list[int] = [1, 3, 7, 14]

ROLL_VARS: list[str] = [
    "stress",
    "sleep_hours",
    "itch",
    "alcohol_units",
    "uv_index_max",
    "pm2_5",
    "humidity_mean_pct",
]
ROLL_WINDOWS: list[int] = [3, 7, 14]

CURRENT_VARS: list[str] = [
    "severity_baseline",
    "severity_delta",
    "sleep_debt_7d",
    "temp_mean_c",
    "humidity_mean_pct",
    "uv_index_max",
]

# SPEC-DEVIATION: §7.3 does not say how many observations a rolling window
# needs before it produces a value, but the answer changes every rolling
# feature, so it has to be pinned somewhere. These follow ceil(0.6 * w), lining
# up with the 40%-missing prediction guard in §7.5.3, and are written out as
# literals rather than computed so Python and TypeScript cannot disagree about
# float rounding at the boundary.
MIN_PERIODS: dict[int, int] = {3: 2, 7: 5, 14: 9}

# §7.5.1 Forward-fill horizon for base variables, in days.
FFILL_LIMIT: int = 3

# §7.5.3 Refuse to predict when more than this fraction of the trailing
# RECENT_WINDOW days have no check-in at all.
MAX_MISSING_FRACTION: float = 0.40
RECENT_WINDOW: int = 14

# §8.6 min_days_required: below this there is no lag14 feature to compute and
# the app refuses to show a number at all (FR-4.2).
MIN_HISTORY_DAYS: int = 14

# §8.1 Target definition.
FLARE_HORIZON_DAYS: int = 3
FLARE_DELTA: float = 3.0
BASELINE_WINDOW: int = 14

# §7.2 Sleep debt is measured against 7.5 h/night over a 7-day window.
SLEEP_TARGET_HOURS: float = 7.5
SLEEP_DEBT_WINDOW: int = 7


def feature_names() -> list[str]:
    """The 95 feature names, in canonical order.

    Order is part of the contract: `model.json` and the parity fixtures are
    both emitted in this order, and the app relies on it for nothing but
    reproducibility of the fixtures — scoring itself is name-keyed.
    """
    names: list[str] = []
    for var in LAG_VARS:
        for lag in LAGS:
            names.append(f"{var}_lag{lag}")
    for var in ROLL_VARS:
        for window in ROLL_WINDOWS:
            names.append(f"{var}_roll{window}")
    names.extend(CURRENT_VARS)
    return names


FEATURE_NAMES: list[str] = feature_names()
N_FEATURES: int = len(FEATURE_NAMES)

assert N_FEATURES == 95, f"expected 95 features per §7.3, got {N_FEATURES}"


# --------------------------------------------------------------------------
# Base frame assembly
# --------------------------------------------------------------------------


def build_base_frame(raw: pd.DataFrame) -> pd.DataFrame:
    """Join-and-clean step: one row per calendar date, gaps materialised.

    `raw` is expected to hold one row per date (the app's join of `checkin`,
    `environment` and `wearable`) with a `date` column of 'YYYY-MM-DD' strings.
    Dates absent from `raw` are inserted as all-missing rows so that lags count
    calendar days, never row positions.
    """
    df = raw.copy()
    if "date" not in df.columns:
        raise ValueError("raw frame must carry a 'date' column")

    for col in BASE_VARS:
        if col not in df.columns:
            df[col] = np.nan

    df = df.sort_values("date").reset_index(drop=True)
    df = _reindex_calendar(df)

    # `has_checkin` records whether the user logged anything that day, and is
    # taken before any filling so the §7.5.3 guard sees real gaps.
    df["has_checkin"] = df["severity"].notna().astype(int)
    # Raw severity is preserved for the target: §8.1 requires rows with a
    # missing future severity to be dropped, never imputed.
    df["severity_raw"] = df["severity"].astype(float)

    df[BASE_VARS] = df[BASE_VARS].astype(float)

    # HD-5: where both exist for a date, the wearable sleep value wins.
    device_sleep = df["sleep_hours_device"]
    df["sleep_hours"] = device_sleep.where(device_sleep.notna(), df["sleep_hours"])

    # §7.5.1 forward-fill each base variable across at most 3 consecutive days.
    df[BASE_VARS] = df[BASE_VARS].ffill(limit=FFILL_LIMIT)

    return _add_derived(df)


def _reindex_calendar(df: pd.DataFrame) -> pd.DataFrame:
    """Insert missing calendar dates between the first and last observed day."""
    stamps = pd.to_datetime(df["date"], format="%Y-%m-%d")
    full = pd.date_range(stamps.min(), stamps.max(), freq="D")
    if len(full) == len(df):
        return df
    out = df.set_index(stamps).reindex(full)
    out["date"] = [d.strftime("%Y-%m-%d") for d in full]
    return out.reset_index(drop=True)


def _add_derived(df: pd.DataFrame) -> pd.DataFrame:
    """§7.2 derived variables. Computed after filling, before lagging."""
    df["temp_delta_1d"] = df["temp_mean_c"] - df["temp_mean_c"].shift(1)
    df["humidity_delta_1d"] = df["humidity_mean_pct"] - df["humidity_mean_pct"].shift(1)
    df["pressure_delta_1d"] = df["pressure_hpa"] - df["pressure_hpa"].shift(1)

    # Sleep debt only means something over a complete week, so all 7 days are
    # required — a partial sum would silently overstate the debt.
    slept = df["sleep_hours"].rolling(SLEEP_DEBT_WINDOW, min_periods=SLEEP_DEBT_WINDOW).sum()
    df["sleep_debt_7d"] = (SLEEP_DEBT_WINDOW * SLEEP_TARGET_HOURS - slept).clip(lower=0.0)

    df["severity_baseline"] = df["severity"].rolling(
        BASELINE_WINDOW, min_periods=MIN_PERIODS[BASELINE_WINDOW]
    ).mean()
    df["severity_delta"] = df["severity"] - df["severity_baseline"]
    return df


# --------------------------------------------------------------------------
# Feature matrix
# --------------------------------------------------------------------------


def build_features(base: pd.DataFrame) -> pd.DataFrame:
    """Expand a base frame into the 95-column feature matrix (§7.3)."""
    out: dict[str, pd.Series] = {}
    for var in LAG_VARS:
        series = base[var]
        for lag in LAGS:
            out[f"{var}_lag{lag}"] = series.shift(lag)
    for var in ROLL_VARS:
        series = base[var]
        for window in ROLL_WINDOWS:
            out[f"{var}_roll{window}"] = series.rolling(
                window, min_periods=MIN_PERIODS[window]
            ).mean()
    for var in CURRENT_VARS:
        out[var] = base[var]

    frame = pd.DataFrame(out, index=base.index)
    return frame[FEATURE_NAMES]


def compute_target(base: pd.DataFrame) -> pd.Series:
    """§8.1 flare_next_72h. NaN marks a row that must be dropped, not imputed."""
    raw = base["severity_raw"]
    future = pd.concat(
        [raw.shift(-h) for h in range(1, FLARE_HORIZON_DAYS + 1)], axis=1
    )
    peak = future.max(axis=1)
    complete = future.notna().all(axis=1)
    baseline = base["severity_baseline"]

    target = (peak >= baseline + FLARE_DELTA).astype(float)
    target[~complete | baseline.isna()] = np.nan
    return target


def recent_checkin_coverage(base: pd.DataFrame) -> pd.Series:
    """Fraction of the trailing 14 calendar days that carry a real check-in."""
    return base["has_checkin"].rolling(RECENT_WINDOW, min_periods=1).mean()


def can_predict(base: pd.DataFrame) -> pd.Series:
    """§7.5.3 guard. False where too much of the recent window is missing."""
    return recent_checkin_coverage(base) >= (1.0 - MAX_MISSING_FRACTION)


def build_dataset(
    panel: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series, pd.Series, pd.Series]:
    """Expand the long simulator panel into a modelling matrix.

    Returns `(X, y, groups, dates)` keeping only rows that are simultaneously
    scoreable and gradeable: past the 14-day warm-up so every lag exists, with
    enough recent check-ins to satisfy §7.5.3, and with a complete 3-day future
    so §8.1 can label them. Rows failing any of those are dropped, never
    imputed — an unlabelled row is not a negative.
    """
    frames: list[pd.DataFrame] = []
    targets: list[pd.Series] = []
    groups: list[pd.Series] = []
    dates: list[pd.Series] = []

    for patient_id, group in panel.groupby("patient_id", sort=True):
        base = build_base_frame(group)
        matrix = build_features(base)
        target = compute_target(base)

        warm = pd.Series(np.arange(len(base)) >= MIN_HISTORY_DAYS, index=base.index)
        usable = warm & target.notna() & can_predict(base)

        frames.append(matrix[usable])
        targets.append(target[usable])
        groups.append(pd.Series(patient_id, index=base.index[usable]))
        dates.append(base.loc[usable, "date"])

    X = pd.concat(frames, ignore_index=True)
    y = pd.concat(targets, ignore_index=True).astype(int)
    g = pd.concat(groups, ignore_index=True).astype(int)
    d = pd.concat(dates, ignore_index=True)
    return X, y, g, d


class Standardizer:
    """§7.6 z-scoring, with the §7.5.2 mean-imputation folded in.

    Kept deliberately dumb so it is the same three lines as `scorer.ts`:
    a feature that is missing becomes its training mean, which standardises to
    exactly zero, which contributes exactly nothing to the score.
    """

    def __init__(self, means: np.ndarray, stds: np.ndarray) -> None:
        self.means = means
        self.stds = stds

    @classmethod
    def fit(cls, X: pd.DataFrame) -> "Standardizer":
        values = X.to_numpy(dtype=float)
        with np.errstate(invalid="ignore"):
            means = np.nanmean(values, axis=0)
            stds = np.nanstd(values, axis=0)
        # An all-missing column has no mean; zero is the only safe stand-in and
        # its zero std makes it inert anyway.
        means = np.nan_to_num(means, nan=0.0)
        stds = np.nan_to_num(stds, nan=0.0)
        return cls(means, stds)

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        values = X.to_numpy(dtype=float)
        safe = np.where(self.stds < 1e-8, 1.0, self.stds)
        z = (values - self.means) / safe
        z[:, self.stds < 1e-8] = 0.0
        return np.nan_to_num(z, nan=0.0)


def latest_feature_vector(raw: pd.DataFrame) -> tuple[dict[str, float | None], bool]:
    """Features for the most recent date in `raw`, as the app computes them.

    Returns `(vector, predictable)`. NaN is normalised to `None` so the shape
    matches the TypeScript `Record<string, number | null>` the scorer consumes.
    """
    base = build_base_frame(raw)
    features = build_features(base)
    row = features.iloc[-1]
    vector: dict[str, float | None] = {
        name: (None if pd.isna(row[name]) else float(row[name])) for name in FEATURE_NAMES
    }
    return vector, bool(can_predict(base).iloc[-1])
