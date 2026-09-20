"""Tests for the feature spec (REQUIREMENTS §7, §8.1, §15.2).

These guard the Python side of the parity contract. The TypeScript side has a
mirror of each case in `app/src/ml/__tests__/features.test.ts` — when you add
one here, add it there.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import features as F  # noqa: E402

START = pd.Timestamp("2026-01-01")


def frame(severities: list[float | None], **columns: list) -> pd.DataFrame:
    dates = [(START + pd.Timedelta(days=i)).strftime("%Y-%m-%d") for i in range(len(severities))]
    data = {"date": dates, "severity": severities}
    data.update(columns)
    return pd.DataFrame(data)


# --------------------------------------------------------------------------
# Shape
# --------------------------------------------------------------------------


def test_feature_count_is_95():
    assert len(F.FEATURE_NAMES) == 95
    assert len(set(F.FEATURE_NAMES)) == 95


def test_feature_count_matches_the_spec_arithmetic():
    # §7.3: 17 x 4 + 7 x 3 + 6
    assert len(F.LAG_VARS) * len(F.LAGS) == 68
    assert len(F.ROLL_VARS) * len(F.ROLL_WINDOWS) == 21
    assert len(F.CURRENT_VARS) == 6


def test_naming_convention():
    assert "stress_lag7" in F.FEATURE_NAMES
    assert "pm2_5_roll14" in F.FEATURE_NAMES
    assert "severity_baseline" in F.FEATURE_NAMES


# --------------------------------------------------------------------------
# §7.5.1 forward fill
# --------------------------------------------------------------------------


def test_forward_fill_stops_after_three_days():
    raw = frame([6.0, None, None, None, None], stress=[8.0, None, None, None, None])
    base = F.build_base_frame(raw)
    assert base["stress"].tolist()[:4] == [8.0, 8.0, 8.0, 8.0]
    assert pd.isna(base["stress"].iloc[4])


def test_forward_fill_budget_resets_on_a_real_value():
    raw = frame([1.0, None, 2.0, None, None, None], stress=[1.0, None, 2.0, None, None, None])
    base = F.build_base_frame(raw)
    assert base["stress"].iloc[5] == 2.0


def test_has_checkin_records_the_truth_not_the_fill():
    base = F.build_base_frame(frame([5.0, None, None]))
    assert base["has_checkin"].tolist() == [1, 0, 0]
    assert base["severity"].iloc[2] == 5.0  # filled for features
    assert pd.isna(base["severity_raw"].iloc[2])  # but not for the target


# --------------------------------------------------------------------------
# Calendar handling
# --------------------------------------------------------------------------


def test_absent_dates_are_materialised_so_lags_count_calendar_days():
    raw = pd.DataFrame(
        {"date": ["2026-01-01", "2026-01-08"], "severity": [5.0, 5.0], "stress": [9.0, 1.0]}
    )
    base = F.build_base_frame(raw)
    assert len(base) == 8
    features = F.build_features(base)
    assert features["stress_lag7"].iloc[7] == 9.0
    # Forward fill only reaches 3 days, so a week later lag1 is empty.
    assert pd.isna(features["stress_lag1"].iloc[7])


# --------------------------------------------------------------------------
# HD-5
# --------------------------------------------------------------------------


def test_wearable_sleep_overrides_self_report():
    raw = frame(
        [3.0, 3.0],
        sleep_hours=[6.0, 6.0],
        sleep_hours_device=[7.4, None],
    )
    base = F.build_base_frame(raw)
    assert base["sleep_hours"].iloc[0] == 7.4
    assert base["sleep_hours"].iloc[1] == 6.0


# --------------------------------------------------------------------------
# §7.2 derived
# --------------------------------------------------------------------------


def test_one_day_deltas():
    raw = frame([3.0, 3.0], temp_mean_c=[10.0, 4.0])
    base = F.build_base_frame(raw)
    assert pd.isna(base["temp_delta_1d"].iloc[0])
    assert base["temp_delta_1d"].iloc[1] == pytest.approx(-6.0)


def test_sleep_debt_requires_a_complete_week():
    six = frame([3.0] * 6, sleep_hours=[6.0] * 6)
    assert pd.isna(F.build_base_frame(six)["sleep_debt_7d"].iloc[5])

    seven = frame([3.0] * 7, sleep_hours=[6.0] * 7)
    assert F.build_base_frame(seven)["sleep_debt_7d"].iloc[6] == pytest.approx(10.5)


def test_sleep_debt_floors_at_zero():
    week = frame([3.0] * 7, sleep_hours=[9.0] * 7)
    assert F.build_base_frame(week)["sleep_debt_7d"].iloc[6] == 0.0


def test_severity_baseline_needs_min_periods():
    # 8 days is below the 9 required for a 14-day window.
    eight = frame([4.0] * 8)
    assert pd.isna(F.build_base_frame(eight)["severity_baseline"].iloc[7])
    nine = frame([4.0] * 9)
    assert F.build_base_frame(nine)["severity_baseline"].iloc[8] == pytest.approx(4.0)


# --------------------------------------------------------------------------
# §8.1 target
# --------------------------------------------------------------------------


def test_flare_target_fires_on_a_three_point_rise():
    severities = [4.0] * 14 + [4.0, 8.0, 4.0]
    base = F.build_base_frame(frame(severities))
    target = F.compute_target(base)
    # At t=13 the baseline is 4.0 and the next three days peak at 8.
    assert target.iloc[13] == 1.0


def test_flare_target_is_null_when_the_future_is_incomplete():
    severities = [4.0] * 14 + [None, 9.0, 9.0]
    base = F.build_base_frame(frame(severities))
    target = F.compute_target(base)
    # §8.1: rows with a missing future severity are dropped, never imputed —
    # and the fill must not sneak a value in either.
    assert pd.isna(target.iloc[13])


def test_flare_target_is_zero_for_a_stable_stretch():
    base = F.build_base_frame(frame([4.0] * 20))
    assert F.compute_target(base).iloc[13] == 0.0


# --------------------------------------------------------------------------
# §7.5.3 guard
# --------------------------------------------------------------------------


def test_guard_allows_sixty_percent_coverage():
    severities: list[float | None] = [4.0] * 15 + [None] * 5
    base = F.build_base_frame(frame(severities))
    assert bool(F.can_predict(base).iloc[-1]) is True


def test_guard_blocks_past_forty_percent_missing():
    severities: list[float | None] = [4.0] * 14 + [None] * 6
    base = F.build_base_frame(frame(severities))
    assert bool(F.can_predict(base).iloc[-1]) is False


def test_latest_feature_vector_returns_all_95_keys():
    vector, _ = F.latest_feature_vector(frame([5.0] * 20))
    assert sorted(vector) == sorted(F.FEATURE_NAMES)


# --------------------------------------------------------------------------
# VAL-4, in miniature
# --------------------------------------------------------------------------


def test_no_feature_reads_the_future():
    rng = np.random.default_rng(0)
    n = 40
    raw = frame(
        list(rng.integers(0, 11, n).astype(float)),
        stress=list(rng.integers(0, 11, n).astype(float)),
        temp_mean_c=list(rng.normal(10, 5, n)),
        pm2_5=list(rng.normal(12, 4, n)),
    )
    original = F.build_features(F.build_base_frame(raw))

    # Corrupt strictly *after* the cut, then assert everything up to and
    # including the cut is untouched.
    cut = 25
    corrupted = raw.copy()
    numeric = [c for c in corrupted.columns if c != "date"]
    corrupted.loc[cut + 1 :, numeric] = corrupted.loc[cut + 1 :, numeric] * 5.0 + 100.0
    after = F.build_features(F.build_base_frame(corrupted))

    head_a = original.iloc[:26].to_numpy(dtype=float)
    head_b = after.iloc[:26].to_numpy(dtype=float)
    assert np.allclose(head_a, head_b, equal_nan=True)

    tail_changed = not np.allclose(
        np.nan_to_num(original.iloc[26:].to_numpy(dtype=float)),
        np.nan_to_num(after.iloc[26:].to_numpy(dtype=float)),
    )
    assert tail_changed, "corruption did not take effect; the test proves nothing"


# --------------------------------------------------------------------------
# §7.6 standardisation
# --------------------------------------------------------------------------


def test_standardizer_maps_the_mean_to_zero():
    X = pd.DataFrame({"a": [1.0, 2.0, 3.0], "b": [5.0, 5.0, 5.0]})
    std = F.Standardizer.fit(X)
    z = std.transform(pd.DataFrame({"a": [2.0], "b": [5.0]}))
    assert z[0, 0] == pytest.approx(0.0)
    # Zero-variance column contributes nothing (§7.6).
    assert z[0, 1] == 0.0


def test_standardizer_imputes_missing_to_the_mean():
    X = pd.DataFrame({"a": [1.0, 2.0, 3.0]})
    std = F.Standardizer.fit(X)
    assert std.transform(pd.DataFrame({"a": [np.nan]}))[0, 0] == 0.0
