"""M1: pull real historical weather + air quality for the simulator (SIM-3).

Planting triggers on top of *real* environmental series is what makes the
synthetic panel worth anything: temperature, humidity and pressure carry their
true seasonal structure and cross-correlations instead of independent noise.

Writes `data/weather_cache.json`, keyed by city. The cache is the unit of
reproducibility — once it exists, `simulate.py` never touches the network.

Usage:
    python fetch_archive.py                 # fetch (or reuse) the cache
    python fetch_archive.py --refresh       # force a re-fetch
    python fetch_archive.py --offline       # synthesise if the API is down
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import requests

DATA_DIR = Path(__file__).parent / "data"
CACHE_PATH = DATA_DIR / "weather_cache.json"

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

START_DATE = "2024-01-01"
END_DATE = "2024-12-31"

# European cities throughout: Open-Meteo's pollen product (CAMS Europe) has no
# coverage elsewhere, and `pollen_total` is one of the trigger candidates.
CITIES: list[dict[str, object]] = [
    {"name": "London", "latitude": 51.51, "longitude": -0.13},
    {"name": "Berlin", "latitude": 52.52, "longitude": 13.40},
    {"name": "Madrid", "latitude": 40.42, "longitude": -3.70},
    {"name": "Stockholm", "latitude": 59.33, "longitude": 18.07},
    {"name": "Rome", "latitude": 41.90, "longitude": 12.50},
    {"name": "Warsaw", "latitude": 52.23, "longitude": 21.01},
    {"name": "Dublin", "latitude": 53.35, "longitude": -6.26},
    {"name": "Athens", "latitude": 37.98, "longitude": 23.73},
]

# Hourly rather than daily aggregates: the archive's daily variable list has
# changed shape before, whereas these hourly names are long-stable. We do the
# aggregation ourselves, which also keeps it identical to what the app does to
# the air-quality feed (§10.1).
WEATHER_HOURLY = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "surface_pressure",
    "precipitation",
    "wind_speed_10m",
]
AIR_HOURLY = [
    "pm2_5",
    "pm10",
    "ozone",
    "uv_index",
    "alder_pollen",
    "birch_pollen",
    "grass_pollen",
    "ragweed_pollen",
]
POLLEN_SPECIES = ["alder_pollen", "birch_pollen", "grass_pollen", "ragweed_pollen"]

TIMEOUT_S = 30
RETRIES = 3


def _get(url: str, params: dict[str, object]) -> dict:
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            resp = requests.get(url, params=params, timeout=TIMEOUT_S)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001 - retried, then re-raised
            last = exc
            if attempt < RETRIES - 1:
                time.sleep(2**attempt)
    raise RuntimeError(f"[fleur] request failed after {RETRIES} attempts: {url}") from last


def _daily_from_hourly(
    times: list[str], values: dict[str, list[float | None]], how: dict[str, str]
) -> dict[str, dict[str, float]]:
    """Bucket hourly readings into per-date means/maxima/sums."""
    buckets: dict[str, dict[str, list[float]]] = {}
    for i, stamp in enumerate(times):
        day = stamp[:10]
        slot = buckets.setdefault(day, {k: [] for k in values})
        for key, series in values.items():
            v = series[i] if i < len(series) else None
            if v is not None and not (isinstance(v, float) and math.isnan(v)):
                slot[key].append(float(v))

    out: dict[str, dict[str, float]] = {}
    for day, slot in buckets.items():
        row: dict[str, float] = {}
        for key, vals in slot.items():
            if not vals:
                continue
            mode = how.get(key, "mean")
            if mode == "max":
                row[key] = max(vals)
            elif mode == "sum":
                row[key] = sum(vals)
            else:
                row[key] = sum(vals) / len(vals)
        out[day] = row
    return out


def fetch_city(city: dict[str, object]) -> dict[str, dict[str, float]]:
    """One city's daily environment series for the full archive window."""
    common = {
        "latitude": city["latitude"],
        "longitude": city["longitude"],
        "start_date": START_DATE,
        "end_date": END_DATE,
        "timezone": "auto",
    }

    weather = _get(ARCHIVE_URL, {**common, "hourly": ",".join(WEATHER_HOURLY)})
    w_hourly = weather["hourly"]
    daily_weather = _daily_from_hourly(
        w_hourly["time"],
        {k: w_hourly[k] for k in WEATHER_HOURLY if k in w_hourly},
        how={"precipitation": "sum", "wind_speed_10m": "max"},
    )

    try:
        air = _get(AIR_QUALITY_URL, {**common, "hourly": ",".join(AIR_HOURLY)})
        a_hourly = air["hourly"]
        daily_air = _daily_from_hourly(
            a_hourly["time"],
            {k: a_hourly[k] for k in AIR_HOURLY if k in a_hourly},
            how={"uv_index": "max"},
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[fleur] air quality unavailable for {city['name']}: {exc}", file=sys.stderr)
        daily_air = {}

    merged: dict[str, dict[str, float]] = {}
    for day, w in sorted(daily_weather.items()):
        a = daily_air.get(day, {})
        # §10.1: pollen_total sums the available species, missing species as 0.
        pollen = sum(a.get(sp, 0.0) for sp in POLLEN_SPECIES)
        merged[day] = {
            "temp_mean_c": round(w.get("temperature_2m", float("nan")), 3),
            "humidity_mean_pct": round(w.get("relative_humidity_2m", float("nan")), 3),
            "dew_point_c": round(w.get("dew_point_2m", float("nan")), 3),
            "pressure_hpa": round(w.get("surface_pressure", float("nan")), 3),
            "precipitation_mm": round(w.get("precipitation", 0.0), 3),
            "wind_speed_max": round(w.get("wind_speed_10m", float("nan")), 3),
            "uv_index_max": round(a.get("uv_index", float("nan")), 3),
            "pm2_5": round(a.get("pm2_5", float("nan")), 3),
            "pm10": round(a.get("pm10", float("nan")), 3),
            "ozone": round(a.get("ozone", float("nan")), 3),
            "pollen_total": round(pollen, 3),
        }
    return merged


def synthesise_city(city: dict[str, object], seed: int) -> dict[str, dict[str, float]]:
    """Offline fallback: seasonal series with plausible amplitude and coupling.

    Only used when the archive is unreachable. It keeps the pipeline runnable
    on a plane; it is not a substitute for SIM-3 and `simulate.py` records
    which source was used in `ground_truth.json`.
    """
    rng = np.random.default_rng(seed)
    lat = float(city["latitude"])  # type: ignore[arg-type]
    n_days = 366
    day = np.arange(n_days)
    season = np.sin(2 * np.pi * (day - 105) / 365.25)

    temp = 12 + (55 - lat) * 0.45 + 10.5 * season + _ar1(rng, n_days, 0.78, 2.2)
    humidity = np.clip(74 - 9 * season + _ar1(rng, n_days, 0.7, 7.0), 25, 100)
    pressure = 1013 + _ar1(rng, n_days, 0.75, 7.5)
    dew = temp - (100 - humidity) / 5.0
    uv = np.clip(3.6 + 3.2 * season + _ar1(rng, n_days, 0.5, 0.9), 0, 11)
    precip = np.clip(rng.gamma(0.6, 3.2, n_days) * (rng.random(n_days) < 0.34), 0, None)
    wind = np.clip(14 + _ar1(rng, n_days, 0.6, 5.0), 1, None)
    pm = np.clip(11 - 4 * season + _ar1(rng, n_days, 0.72, 5.0), 1, None)
    pollen = np.clip(
        95 * np.exp(-(((day - 118) / 26) ** 2)) + 55 * np.exp(-(((day - 168) / 34) ** 2)),
        0,
        None,
    ) * (0.55 + 0.9 * rng.random(n_days))

    out: dict[str, dict[str, float]] = {}
    base = np.datetime64(START_DATE)
    for i in range(n_days):
        date = str(base + np.timedelta64(i, "D"))
        out[date] = {
            "temp_mean_c": round(float(temp[i]), 3),
            "humidity_mean_pct": round(float(humidity[i]), 3),
            "dew_point_c": round(float(dew[i]), 3),
            "pressure_hpa": round(float(pressure[i]), 3),
            "precipitation_mm": round(float(precip[i]), 3),
            "wind_speed_max": round(float(wind[i]), 3),
            "uv_index_max": round(float(uv[i]), 3),
            "pm2_5": round(float(pm[i]), 3),
            "pm10": round(float(pm[i] * 1.7), 3),
            "ozone": round(float(58 + 16 * season[i]), 3),
            "pollen_total": round(float(pollen[i]), 3),
        }
    return out


def _ar1(rng: np.random.Generator, n: int, phi: float, sigma: float) -> np.ndarray:
    out = np.zeros(n)
    for i in range(1, n):
        out[i] = phi * out[i - 1] + rng.normal(0, sigma)
    return out


def load_or_fetch(refresh: bool = False, offline: bool = False) -> dict:
    if CACHE_PATH.exists() and not refresh:
        with CACHE_PATH.open() as fh:
            cached = json.load(fh)
        print(f"[fleur] using cached weather for {len(cached['cities'])} cities")
        return cached

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cities: dict[str, dict] = {}
    source = "open-meteo-archive"

    for idx, city in enumerate(CITIES):
        name = str(city["name"])
        if offline:
            cities[name] = synthesise_city(city, seed=1000 + idx)
            source = "synthetic-fallback"
            continue
        try:
            print(f"[fleur] fetching {name} ...", flush=True)
            cities[name] = fetch_city(city)
        except Exception as exc:  # noqa: BLE001
            print(f"[fleur] archive failed for {name}: {exc}", file=sys.stderr)
            cities[name] = synthesise_city(city, seed=1000 + idx)
            source = "mixed-archive-and-fallback"

    payload = {
        "source": source,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "cities": cities,
    }
    with CACHE_PATH.open("w") as fh:
        json.dump(payload, fh)
    print(f"[fleur] wrote {CACHE_PATH} ({source}, {len(cities)} cities)")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch historical environment data")
    parser.add_argument("--refresh", action="store_true", help="ignore an existing cache")
    parser.add_argument("--offline", action="store_true", help="skip the network entirely")
    args = parser.parse_args()

    payload = load_or_fetch(refresh=args.refresh, offline=args.offline)
    for name, days in payload["cities"].items():
        sample = next(iter(days.values()))
        filled = sum(1 for v in sample.values() if not math.isnan(v))
        print(f"  {name:<10} {len(days):>4} days, {filled}/{len(sample)} vars on day 1")


if __name__ == "__main__":
    main()
