"""M3: feature name -> human-readable label (REQUIREMENTS §8.6).

The app renders `label` verbatim and is forbidden from constructing display
strings out of `name` (§8.6), so every shipped feature must resolve here.

House style, per §13.1: neutral nouns, no verbs that imply causation, no
alarm words. "Stress, about a week ago" — not "Stress spike triggered a flare".
"""

from __future__ import annotations

import features as F

# What the variable is, phrased for someone who has never seen the schema.
VARIABLE_LABELS: dict[str, str] = {
    "stress": "Stress",
    "sleep_hours": "Sleep",
    "itch": "Itch",
    "alcohol_units": "Alcohol",
    "water_glasses": "Water",
    "diet_dairy": "Dairy",
    "diet_gluten": "Gluten",
    "diet_processed": "Processed food",
    "diet_sugar": "Sugar",
    "diet_red_meat": "Red meat",
    "illness": "Being unwell",
    "sore_throat": "Sore throat",
    "skin_injury": "Skin injury",
    "severity": "Skin severity",
    "temp_delta_1d": "Temperature swing",
    "humidity_delta_1d": "Humidity swing",
    "pressure_delta_1d": "Air-pressure swing",
    "temp_mean_c": "Temperature",
    "humidity_mean_pct": "Humidity",
    "dew_point_c": "Dew point",
    "pressure_hpa": "Air pressure",
    "uv_index_max": "Sunlight (UV)",
    "precipitation_mm": "Rainfall",
    "pm2_5": "Air pollution",
    "pollen_total": "Pollen",
}

# When it happened. §4.5 gives the required shape: `stress_lag7` must read as
# "Stress, about a week ago".
LAG_LABELS: dict[int, str] = {
    1: "yesterday",
    3: "about 3 days ago",
    7: "about a week ago",
    14: "about 2 weeks ago",
}

ROLL_LABELS: dict[int, str] = {
    3: "averaged over the last 3 days",
    7: "averaged over the last week",
    14: "averaged over the last 2 weeks",
}

# The unlagged features describe a state rather than a past event, so each one
# is written out longhand instead of composed.
CURRENT_LABELS: dict[str, str] = {
    "severity_baseline": "Your usual severity lately",
    "severity_delta": "Today compared with your usual",
    "sleep_debt_7d": "Sleep debt over the last week",
    "temp_mean_c": "Temperature today",
    "humidity_mean_pct": "Humidity today",
    "uv_index_max": "Sunlight (UV) today",
}


def build_labels() -> dict[str, str]:
    """Every one of the 95 feature names mapped to display text."""
    labels: dict[str, str] = {}

    for var in F.LAG_VARS:
        subject = VARIABLE_LABELS[var]
        for lag in F.LAGS:
            labels[f"{var}_lag{lag}"] = f"{subject}, {LAG_LABELS[lag]}"

    for var in F.ROLL_VARS:
        subject = VARIABLE_LABELS[var]
        for window in F.ROLL_WINDOWS:
            labels[f"{var}_roll{window}"] = f"{subject}, {ROLL_LABELS[window]}"

    for var in F.CURRENT_VARS:
        labels[var] = CURRENT_LABELS[var]

    return labels


LABELS: dict[str, str] = build_labels()


def missing_labels(feature_names: list[str]) -> list[str]:
    """M3 exit criterion: labels.py must cover every feature being shipped."""
    return [name for name in feature_names if name not in LABELS]


if __name__ == "__main__":
    gaps = missing_labels(F.FEATURE_NAMES)
    print(f"[fleur] {len(LABELS)} labels for {len(F.FEATURE_NAMES)} features")
    if gaps:
        raise SystemExit(f"[fleur] missing labels: {gaps}")
    for name in F.FEATURE_NAMES[:5] + F.FEATURE_NAMES[-6:]:
        print(f"  {name:<28} {LABELS[name]}")
