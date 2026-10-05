"""Turns the fake patient data into daily features."""
from __future__ import annotations

import numpy as np
import pandas as pd


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

WEARABLE_VARS: list[str] = ["sleep_hours_device", "resting_hr", "steps"]

DERIVED_VARS: list[str] = [
    "temp_delta_1d",
    "humidity_delta_1d",
    "pressure_delta_1d",
    "sleep_debt_7d",
    "severity_baseline",
    "severity_delta",
]

BASE_VARS: list[str] = SELF_VARS + ENV_VARS + WEARABLE_VARS


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

MIN_PERIODS: dict[int, int] = {3: 2, 7: 5, 14: 9}

FFILL_LIMIT: int = 3

MAX_MISSING_FRACTION: float = 0.40
RECENT_WINDOW: int = 14

MIN_HISTORY_DAYS: int = 14

FLARE_HORIZON_DAYS: int = 3
FLARE_DELTA: float = 3.0
BASELINE_WINDOW: int = 14

SLEEP_TARGET_HOURS: float = 7.5
SLEEP_DEBT_WINDOW: int = 7


def feature_names() -> list[str]:
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

assert N_FEATURES == 95, f"expected 95 features, got {N_FEATURES}"


def build_base_frame(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    if "date" not in df.columns:
        raise ValueError("raw frame must carry a 'date' column")

    for col in BASE_VARS:
        if col not in df.columns:
            df[col] = np.nan

    df = df.sort_values("date").reset_index(drop=True)
    df = _reindex_calendar(df)

    df["has_checkin"] = df["severity"].notna().astype(int)
    df["severity_raw"] = df["severity"].astype(float)

    df[BASE_VARS] = df[BASE_VARS].astype(float)

    device_sleep = df["sleep_hours_device"]
    df["sleep_hours"] = device_sleep.where(device_sleep.notna(), df["sleep_hours"])

    df[BASE_VARS] = df[BASE_VARS].ffill(limit=FFILL_LIMIT)

    return _add_derived(df)


def _reindex_calendar(df: pd.DataFrame) -> pd.DataFrame:
    stamps = pd.to_datetime(df["date"], format="%Y-%m-%d")
    full = pd.date_range(stamps.min(), stamps.max(), freq="D")
    if len(full) == len(df):
        return df
    out = df.set_index(stamps).reindex(full)
    out["date"] = [d.strftime("%Y-%m-%d") for d in full]
    return out.reset_index(drop=True)


def _add_derived(df: pd.DataFrame) -> pd.DataFrame:
    df["temp_delta_1d"] = df["temp_mean_c"] - df["temp_mean_c"].shift(1)
    df["humidity_delta_1d"] = df["humidity_mean_pct"] - df["humidity_mean_pct"].shift(1)
    df["pressure_delta_1d"] = df["pressure_hpa"] - df["pressure_hpa"].shift(1)

    slept = df["sleep_hours"].rolling(SLEEP_DEBT_WINDOW, min_periods=SLEEP_DEBT_WINDOW).sum()
    df["sleep_debt_7d"] = (SLEEP_DEBT_WINDOW * SLEEP_TARGET_HOURS - slept).clip(lower=0.0)

    df["severity_baseline"] = df["severity"].rolling(
        BASELINE_WINDOW, min_periods=MIN_PERIODS[BASELINE_WINDOW]
    ).mean()
    df["severity_delta"] = df["severity"] - df["severity_baseline"]
    return df


def build_features(base: pd.DataFrame) -> pd.DataFrame:
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
    return base["has_checkin"].rolling(RECENT_WINDOW, min_periods=1).mean()


def can_predict(base: pd.DataFrame) -> pd.Series:
    return recent_checkin_coverage(base) >= (1.0 - MAX_MISSING_FRACTION)


def build_dataset(
    panel: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series, pd.Series, pd.Series]:
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

    def __init__(self, means: np.ndarray, stds: np.ndarray) -> None:
        self.means = means
        self.stds = stds

    @classmethod
    def fit(cls, X: pd.DataFrame) -> "Standardizer":
        values = X.to_numpy(dtype=float)
        with np.errstate(invalid="ignore"):
            means = np.nanmean(values, axis=0)
            stds = np.nanstd(values, axis=0)
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
    base = build_base_frame(raw)
    features = build_features(base)
    row = features.iloc[-1]
    vector: dict[str, float | None] = {
        name: (None if pd.isna(row[name]) else float(row[name])) for name in FEATURE_NAMES
    }
    return vector, bool(can_predict(base).iloc[-1])
