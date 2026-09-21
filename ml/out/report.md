# Fleur — model report

Model: L1 logistic regression (§8.4), C=0.01, threshold=0.2215
Data: 1500 simulated patients, weather source `open-meteo-archive`, seed 20260729

## Held-out performance (§8.3)

| Metric | Value | Target |
|---|---|---|
| Average precision | 0.3905 | >= 0.30 |
| Precision @ threshold | 0.4529 | >= 0.55 |
| Recall @ threshold | 0.3493 | >= 0.35 |
| ROC AUC | 0.7630 | (not the selection metric) |
| Base rate | 0.0990 | — |
| Lift over base rate | 3.94x | ~3x |
| Nonzero coefficients | 71 / 95 | — |

Rows: 148,418 train (1200 patients), 37,410 test (300 patients). Split is by patient (TR-1).

## Hyperparameter sweep (TR-3)

| C | CV average precision |
|---|---|
| 0.01 | 0.3783 **(selected)** |
| 0.03 | 0.3773 |
| 0.1 | 0.3767 |
| 0.3 | 0.3765 |
| 1.0 | 0.3764 |
| 3.0 | 0.3764 |

## Coefficients

| Feature | Coefficient |
|---|---|
| `severity_delta` | +0.8557 |
| `severity_baseline` | -0.2322 |
| `stress_roll14` | +0.2029 |
| `pm2_5_roll3` | +0.1887 |
| `sleep_debt_7d` | +0.1397 |
| `illness_lag7` | +0.1388 |
| `alcohol_units_roll3` | +0.1130 |
| `alcohol_units_roll14` | -0.1036 |
| `stress_roll3` | -0.1013 |
| `sleep_hours_roll14` | +0.0894 |
| `sleep_hours_lag3` | -0.0861 |
| `sleep_hours_roll7` | -0.0751 |
| `diet_processed_lag3` | +0.0737 |
| `stress_lag14` | -0.0637 |
| `pm2_5_roll14` | -0.0532 |
| `temp_delta_1d_lag1` | -0.0515 |
| `uv_index_max` | -0.0435 |
| `pm2_5_lag14` | -0.0389 |
| `humidity_mean_pct_lag14` | +0.0385 |
| `pressure_delta_1d_lag1` | -0.0383 |
| `illness_lag14` | +0.0382 |
| `stress_lag3` | -0.0379 |
| `diet_sugar_lag3` | +0.0359 |
| `diet_processed_lag1` | +0.0355 |
| `alcohol_units_lag3` | +0.0351 |
| `humidity_mean_pct_lag1` | -0.0347 |
| `diet_dairy_lag3` | +0.0319 |
| `pm2_5_lag3` | +0.0312 |
| `stress_lag7` | +0.0311 |
| `sleep_hours_lag14` | +0.0297 |
| `sleep_hours_lag7` | +0.0271 |
| `alcohol_units_lag14` | -0.0247 |
| `illness_lag3` | -0.0216 |
| `itch_lag14` | +0.0208 |
| `itch_lag3` | -0.0194 |
| `pollen_total_lag14` | +0.0188 |
| `diet_processed_lag14` | -0.0168 |
| `diet_dairy_lag7` | -0.0167 |
| `sore_throat_lag14` | +0.0162 |
| `temp_delta_1d_lag7` | +0.0159 |
| `temp_delta_1d_lag3` | +0.0153 |
| `stress_roll7` | -0.0149 |
| `alcohol_units_lag7` | +0.0141 |
| `sore_throat_lag7` | -0.0141 |
| `pm2_5_lag7` | -0.0128 |
| `diet_dairy_lag14` | -0.0126 |
| `pressure_delta_1d_lag3` | -0.0126 |
| `itch_lag1` | +0.0122 |
| `pressure_delta_1d_lag14` | -0.0114 |
| `skin_injury_lag14` | +0.0095 |
| `pressure_delta_1d_lag7` | -0.0093 |
| `diet_sugar_lag7` | +0.0080 |
| `humidity_delta_1d_lag14` | -0.0079 |
| `uv_index_max_lag7` | -0.0071 |
| `humidity_mean_pct` | -0.0067 |
| `alcohol_units_lag1` | +0.0064 |
| `alcohol_units_roll7` | +0.0050 |
| `sleep_hours_roll3` | -0.0046 |
| `humidity_delta_1d_lag3` | -0.0044 |
| `skin_injury_lag3` | +0.0040 |
| `humidity_delta_1d_lag1` | -0.0040 |
| `humidity_delta_1d_lag7` | -0.0038 |
| `diet_processed_lag7` | +0.0036 |
| `pollen_total_lag1` | +0.0034 |
| `diet_dairy_lag1` | -0.0033 |
| `diet_sugar_lag1` | +0.0024 |
| `skin_injury_lag1` | -0.0022 |
| `pollen_total_lag7` | +0.0014 |
| `sore_throat_lag3` | +0.0009 |
| `humidity_mean_pct_lag3` | -0.0007 |
| `temp_delta_1d_lag14` | +0.0001 |

## Validation (§8.5)

### VAL-1 Trigger recovery — **PASS**

- `top_k`: stress, pm2_5, illness, alcohol_units, sleep_hours
- `k`: 5
- `mean_precision_at_k`: 0.3220
- `mean_trigger_recall`: 1.0000
- `selected_variables`: alcohol_units, diet_dairy, diet_processed, diet_sugar, humidity_delta_1d, humidity_mean_pct, illness, itch, pm2_5, pollen_total, pressure_delta_1d, skin_injury, sleep_hours, sore_throat, stress, temp_delta_1d, uv_index_max
- `selected_precision`: 0.7059
- `distractors_selected`: diet_dairy, humidity_mean_pct, itch, pollen_total, uv_index_max
- `distractors_available`: diet_dairy, humidity_mean_pct, itch, pollen_total, uv_index_max
- `population_top5_overlap`: 0.8000
- `planted_counts`: stress=800, sleep_hours=680, illness=396, alcohol_units=330, temp_delta_1d=309, skin_injury=299, pm2_5=246, sore_throat=196, humidity_delta_1d=150, diet_processed=126, pressure_delta_1d=94, diet_sugar=90

### VAL-2 Leakage test — **FAIL**

- `ap_full`: 0.3905
- `ap_without_lags`: 0.3868
- `ap_baseline_only`: 0.3735
- `ap_trigger_features_only`: 0.2233
- `drop_fraction`: 0.0093
- `baseline_share_of_full`: 0.9565

### VAL-3 Null test — **PASS**

- `ap_shuffled`: 0.0890
- `base_rate`: 0.0990
- `ratio`: 0.8984

### VAL-4 Temporal sanity — **PASS**

- `rows_checked`: 61
- `cells_differing`: 0
- `leaking_features`: (none)
- `future_actually_changed`: True
