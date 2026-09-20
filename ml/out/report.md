# Fleur — model report

Model: L1 logistic regression (§8.4), C=0.01, threshold=0.2128
Data: 200 simulated patients, weather source `open-meteo-archive`, seed 20260729

## Held-out performance (§8.3)

| Metric | Value | Target |
|---|---|---|
| Average precision | 0.3271 | >= 0.30 |
| Precision @ threshold | 0.3719 | >= 0.55 |
| Recall @ threshold | 0.3285 | >= 0.35 |
| ROC AUC | 0.7478 | (not the selection metric) |
| Base rate | 0.0815 | — |
| Lift over base rate | 4.01x | ~3x |
| Nonzero coefficients | 39 / 95 | — |

Rows: 19,802 train (160 patients), 5,042 test (40 patients). Split is by patient (TR-1).

## Hyperparameter sweep (TR-3)

| C | CV average precision |
|---|---|
| 0.01 | 0.3689 **(selected)** |
| 0.03 | 0.3617 |
| 0.1 | 0.3550 |
| 0.3 | 0.3520 |
| 1.0 | 0.3508 |
| 3.0 | 0.3505 |

## Coefficients

| Feature | Coefficient |
|---|---|
| `severity_delta` | +0.8558 |
| `pm2_5_roll3` | +0.1616 |
| `sleep_debt_7d` | +0.1470 |
| `stress_roll14` | +0.1418 |
| `humidity_mean_pct` | +0.1054 |
| `illness_lag7` | +0.0959 |
| `severity_baseline` | -0.0827 |
| `stress_roll3` | -0.0757 |
| `diet_sugar_lag3` | +0.0753 |
| `illness_lag14` | -0.0694 |
| `diet_dairy_lag7` | -0.0629 |
| `sleep_hours_roll7` | -0.0589 |
| `pollen_total_lag14` | +0.0582 |
| `diet_dairy_lag1` | -0.0557 |
| `alcohol_units_roll14` | -0.0425 |
| `sleep_hours_lag3` | -0.0424 |
| `diet_sugar_lag1` | +0.0414 |
| `alcohol_units_roll3` | +0.0395 |
| `alcohol_units_lag3` | +0.0348 |
| `diet_processed_lag3` | +0.0340 |
| `temp_delta_1d_lag1` | -0.0311 |
| `skin_injury_lag14` | +0.0311 |
| `itch_roll3` | -0.0298 |
| `skin_injury_lag7` | +0.0258 |
| `diet_sugar_lag7` | +0.0218 |
| `skin_injury_lag1` | -0.0211 |
| `illness_lag3` | -0.0206 |
| `humidity_mean_pct_lag14` | +0.0154 |
| `diet_dairy_lag14` | -0.0146 |
| `pm2_5_lag1` | +0.0139 |
| `diet_processed_lag7` | -0.0133 |
| `diet_dairy_lag3` | -0.0059 |
| `diet_processed_lag1` | +0.0059 |
| `pollen_total_lag7` | -0.0055 |
| `pollen_total_lag3` | +0.0038 |
| `sore_throat_lag7` | -0.0024 |
| `pm2_5_roll14` | +0.0014 |
| `temp_delta_1d_lag7` | +0.0013 |
| `stress_lag7` | +0.0009 |

## Validation (§8.5)

### VAL-1 Trigger recovery — **PASS**

- `top_k`: pm2_5, stress, humidity_mean_pct, illness, diet_sugar
- `k`: 5
- `mean_precision_at_k`: 0.2250
- `mean_trigger_recall`: 0.9583
- `selected_variables`: alcohol_units, diet_dairy, diet_processed, diet_sugar, humidity_mean_pct, illness, itch, pm2_5, pollen_total, skin_injury, sleep_hours, sore_throat, stress, temp_delta_1d
- `selected_precision`: 0.7143
- `distractors_selected`: diet_dairy, humidity_mean_pct, itch, pollen_total
- `distractors_available`: diet_dairy, humidity_mean_pct, itch, pollen_total, uv_index_max
- `population_top5_overlap`: 0.4000
- `planted_counts`: stress=116, sleep_hours=91, illness=48, temp_delta_1d=40, sore_throat=40, pm2_5=36, skin_injury=35, alcohol_units=30, humidity_delta_1d=18, diet_sugar=18, diet_processed=15, pressure_delta_1d=12

### VAL-2 Leakage test — **FAIL**

- `ap_full`: 0.3271
- `ap_without_lags`: 0.3373
- `ap_baseline_only`: 0.3449
- `ap_trigger_features_only`: 0.1720
- `drop_fraction`: -0.0310
- `baseline_share_of_full`: 1.0543

### VAL-3 Null test — **PASS**

- `ap_shuffled`: 0.0952
- `base_rate`: 0.0815
- `ratio`: 1.1683

### VAL-4 Temporal sanity — **PASS**

- `rows_checked`: 61
- `cells_differing`: 0
- `leaking_features`: (none)
- `future_actually_changed`: True
