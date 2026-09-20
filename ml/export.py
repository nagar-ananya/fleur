"""M3: write model.json and the parity fixtures (REQUIREMENTS §8.6, §15.1).

    python export.py

Outputs
    out/model.json            the shipped artefact, copied to app/assets/
    out/parity_fixtures.json  10 windows the Jest parity test replays

The parity fixtures are the reason the TypeScript port cannot silently drift:
they carry raw daily rows *and* the 95 numbers Python derived from them, so a
mismatch in either implementation shows up as a failing test rather than as a
quietly wrong risk score on someone's phone.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

import features as F
import labels as L

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "out"

SCHEMA_VERSION = 1
MODEL_VERSION = "1.0.0"
MODEL_TYPE = "logistic_regression_l1"
HORIZON_HOURS = 72

N_FIXTURES = 10
FIXTURE_WINDOW_DAYS = 30  # comfortably covers the deepest lookback (t-15)


def _round(value: float, places: int = 6) -> float:
    return float(np.round(float(value), places))


def build_model_json(trained: dict) -> dict:
    names: list[str] = list(trained["feature_names"])
    coefficients = trained["coefficients"]
    means = trained["means"]
    stds = trained["stds"]

    gaps = L.missing_labels(names)
    if gaps:
        raise SystemExit(f"[fleur] labels.py is missing entries for: {gaps}")

    features = []
    for name, coef, mean, std in zip(names, coefficients, means, stds):
        # §8.6 allows dropping L1-zeroed features; the app treats anything
        # absent from the array as a zero coefficient.
        if coef == 0.0:
            continue
        features.append(
            {
                "name": name,
                "mean": _round(mean),
                "std": _round(std),
                "coefficient": _round(coef),
                "label": L.LABELS[name],
                "direction": "increases" if coef > 0 else "decreases",
            }
        )
    features.sort(key=lambda f: -abs(f["coefficient"]))

    metrics = trained["metrics"]
    return {
        "schema_version": SCHEMA_VERSION,
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model_type": MODEL_TYPE,
        "horizon_hours": HORIZON_HOURS,
        "min_days_required": F.MIN_HISTORY_DAYS,
        "threshold": _round(trained["threshold"], 4),
        "intercept": _round(trained["intercept"], 4),
        "features": features,
        "metrics": {
            "average_precision": _round(metrics["average_precision"], 4),
            "precision_at_threshold": _round(metrics["precision_at_threshold"], 4),
            "recall_at_threshold": _round(metrics["recall_at_threshold"], 4),
            "base_rate": _round(metrics["base_rate"], 4),
            "n_train_patients": metrics["n_train_patients"],
            "n_test_patients": metrics["n_test_patients"],
        },
    }


def score(vector: dict[str, float | None], model: dict) -> tuple[float, list[dict]]:
    """The reference implementation of §9.1, mirrored by `app/src/ml/scorer.ts`."""
    z = model["intercept"]
    contributions: list[dict] = []
    for feature in model["features"]:
        raw = vector.get(feature["name"])
        if raw is None:
            raw = feature["mean"]
        std = 1.0 if feature["std"] < 1e-8 else feature["std"]
        contribution = feature["coefficient"] * ((raw - feature["mean"]) / std)
        z += contribution
        contributions.append({"name": feature["name"], "contribution": _round(contribution)})
    return 1.0 / (1.0 + math.exp(-z)), contributions


def band_of(probability: float, threshold: float) -> str:
    """§9.4 risk bands."""
    if probability < threshold * 0.6:
        return "low"
    if probability < threshold:
        return "elevated"
    return "high"


def _window_rows(panel: pd.DataFrame, patient_id: int, end_index: int) -> pd.DataFrame:
    patient = panel[panel["patient_id"] == patient_id].reset_index(drop=True)
    start = max(0, end_index - FIXTURE_WINDOW_DAYS + 1)
    return patient.iloc[start : end_index + 1].reset_index(drop=True)


def _to_json_rows(window: pd.DataFrame, drop_dates: set[str] | None = None) -> list[dict]:
    """Serialise a window the way the app's DB join would hand it over."""
    columns = ["date"] + F.SELF_VARS + F.ENV_VARS + F.WEARABLE_VARS
    rows: list[dict] = []
    for _, row in window.iterrows():
        date = str(row["date"])
        if drop_dates and date in drop_dates:
            continue  # the date is absent entirely, not merely null
        record: dict[str, object] = {}
        for col in columns:
            value = row.get(col)
            if col == "date":
                record[col] = date
            elif value is None or (isinstance(value, float) and math.isnan(value)):
                record[col] = None
            else:
                record[col] = _round(float(value))
        rows.append(record)
    return rows


def _describe(window: pd.DataFrame, dropped: set[str]) -> tuple[str, int, int]:
    missing = int(window["severity"].isna().sum()) + len(dropped)
    longest = run = 0
    for _, row in window.iterrows():
        gap = pd.isna(row["severity"]) or str(row["date"]) in dropped
        run = run + 1 if gap else 0
        longest = max(longest, run)
    return (
        f"{len(window)}-day window, {missing} day(s) without a check-in, "
        f"longest gap {longest}",
        missing,
        longest,
    )


def build_fixtures(panel: pd.DataFrame, model: dict) -> list[dict]:
    """TEST-1/TEST-4: 10 windows from held-out patients, with expected output.

    Selection is deliberate rather than random — the set has to exercise the
    §7.5 missing-data policy, so it includes clean windows, scattered gaps,
    gaps longer than the 3-day forward-fill cap, a window where a date is
    absent from the data entirely, and one that trips the 40% guard.
    """
    test_ids = sorted(panel[panel["patient_id"] > 160]["patient_id"].unique())
    candidates: list[dict] = []

    for patient_id in test_ids:
        patient = panel[panel["patient_id"] == patient_id].reset_index(drop=True)
        base = F.build_base_frame(patient)
        predictable = F.can_predict(base)
        for end_index in range(FIXTURE_WINDOW_DAYS, len(patient)):
            window = _window_rows(panel, patient_id, end_index)
            severities = window["severity"]
            missing = int(severities.isna().sum())
            longest = 0
            run = 0
            for value in severities:
                run = run + 1 if pd.isna(value) else 0
                longest = max(longest, run)
            recent_missing = int(severities.iloc[-14:].isna().sum())
            candidates.append(
                {
                    "patient_id": int(patient_id),
                    "end_index": end_index,
                    "missing": missing,
                    "longest_gap": longest,
                    "recent_missing": recent_missing,
                    "predictable": bool(predictable.iloc[end_index]),
                }
            )

    def pick(predicate, count: int, used: set) -> list[dict]:
        out = []
        for cand in candidates:
            key = (cand["patient_id"], cand["end_index"])
            if key in used or not predicate(cand):
                continue
            # Spread picks across patients so the set is not one person's month.
            if any(c["patient_id"] == cand["patient_id"] for c in out):
                continue
            used.add(key)
            out.append(cand)
            if len(out) == count:
                break
        return out

    used: set = set()
    chosen: list[dict] = []
    chosen += pick(lambda c: c["missing"] == 0 and c["predictable"], 3, used)
    chosen += pick(lambda c: 1 <= c["missing"] <= 4 and c["longest_gap"] <= 2
                   and c["predictable"], 2, used)
    chosen += pick(lambda c: c["longest_gap"] >= 4 and c["predictable"], 2, used)
    chosen += pick(lambda c: not c["predictable"], 1, used)
    chosen += pick(lambda c: c["missing"] >= 3 and c["predictable"], N_FIXTURES, used)
    chosen = chosen[:N_FIXTURES]

    fixtures: list[dict] = []
    for index, cand in enumerate(chosen):
        window = _window_rows(panel, cand["patient_id"], cand["end_index"])
        # One fixture drops a date outright, so the TypeScript side is forced to
        # rebuild the calendar rather than assume one row per day.
        dropped: set[str] = set()
        if index == 2 and len(window) > 6:
            dropped = {str(window["date"].iloc[-5])}

        rows = _to_json_rows(window, dropped)
        raw = pd.DataFrame(rows)
        vector, predictable = F.latest_feature_vector(raw)
        probability, contributions = score(vector, model)
        description, missing, longest = _describe(window, dropped)

        fixtures.append(
            {
                "id": f"fixture-{index + 1:02d}",
                "patient_id": cand["patient_id"],
                "target_date": str(window["date"].iloc[-1]),
                "description": description,
                "missing_checkin_days": missing,
                "longest_gap_days": longest,
                "dropped_dates": sorted(dropped),
                "rows": rows,
                "expected_can_predict": predictable,
                "expected_features": {
                    name: (None if value is None else _round(value))
                    for name, value in vector.items()
                },
                "expected_probability": _round(probability, 10),
                "expected_band": band_of(probability, model["threshold"]),
                "expected_top_contributions": sorted(
                    contributions, key=lambda c: -c["contribution"]
                )[:3],
            }
        )
    return fixtures


def main() -> None:
    parser = argparse.ArgumentParser(description="Export model.json and parity fixtures")
    parser.add_argument("--app-assets", type=Path, default=ROOT.parent / "app" / "assets")
    args = parser.parse_args()

    trained_npz = np.load(OUT_DIR / "trained.npz", allow_pickle=True)
    with (OUT_DIR / "metrics.json").open() as fh:
        metrics = json.load(fh)["metrics"]

    trained = {
        "feature_names": [str(n) for n in trained_npz["feature_names"]],
        "coefficients": trained_npz["coefficients"],
        "means": trained_npz["means"],
        "stds": trained_npz["stds"],
        "intercept": float(trained_npz["intercept"]),
        "threshold": float(trained_npz["threshold"]),
        "metrics": metrics,
    }

    model = build_model_json(trained)
    model_path = OUT_DIR / "model.json"
    with model_path.open("w") as fh:
        json.dump(model, fh, indent=2)
    size_kb = model_path.stat().st_size / 1024
    print(f"[fleur] wrote {model_path} — {len(model['features'])} features, {size_kb:.1f} KB")

    panel = pd.read_csv(DATA_DIR / "synthetic_panel.csv")
    fixtures = build_fixtures(panel, model)
    fixture_payload = {
        "model_version": model["model_version"],
        "threshold": model["threshold"],
        "generated_from": "ml/export.py",
        "fixtures": fixtures,
    }
    fixture_path = OUT_DIR / "parity_fixtures.json"
    with fixture_path.open("w") as fh:
        json.dump(fixture_payload, fh, indent=2)
    print(f"[fleur] wrote {fixture_path} — {len(fixtures)} windows")
    with_gaps = sum(1 for f in fixtures if f["missing_checkin_days"] > 0)
    print(f"[fleur] fixtures with missing days: {with_gaps} (TEST-4 requires >= 2)")

    if args.app_assets.exists():
        target = args.app_assets / "model.json"
        with target.open("w") as fh:
            json.dump(model, fh, indent=2)
        print(f"[fleur] copied model.json -> {target}")
    else:
        print(f"[fleur] app assets dir not found ({args.app_assets}), skipped copy")


if __name__ == "__main__":
    main()
