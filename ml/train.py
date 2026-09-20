"""M2: train and validate the flare classifier (REQUIREMENTS §8.3).

    python train.py

Writes `out/trained.npz` (consumed by export.py), `out/report.md` and the
figures under `out/figures/`. Deliberately a single linear model — see §8.4 for
why nobody should "upgrade" this to something with more parameters.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold
from sklearn.tree import DecisionTreeClassifier, plot_tree

import features as F
import validate as V

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "out"
FIG_DIR = OUT_DIR / "figures"

C_GRID = [0.01, 0.03, 0.1, 0.3, 1.0, 3.0]  # TR-3
N_SPLITS = 5  # TR-2
TRAIN_PATIENT_MAX = 160  # TR-1
MIN_RECALL = 0.35  # TR-6

# §8.3 acceptance criteria.
TARGETS = {
    "average_precision": 0.30,
    "precision_at_threshold": 0.55,
    "recall_at_threshold": 0.35,
    "trigger_precision": 0.60,
}


def _fit(C: float, Z: np.ndarray, y: np.ndarray) -> LogisticRegression:
    model = LogisticRegression(
        penalty="l1",
        solver="liblinear",
        C=C,
        class_weight="balanced",  # TR-5
        max_iter=5000,
        random_state=0,
    )
    model.fit(Z, y)
    return model


def select_C(X: pd.DataFrame, y: np.ndarray, groups: np.ndarray) -> tuple[float, dict, np.ndarray]:
    """TR-2/TR-3/TR-4: grouped CV over C, scored by average precision.

    Also returns out-of-fold decision scores for the winning C — the threshold
    in TR-6 is picked from those rather than from the test set, which must stay
    untouched until the final evaluation.
    """
    splitter = GroupKFold(n_splits=N_SPLITS)
    folds = list(splitter.split(X, y, groups))
    history: dict[float, float] = {}
    oof_by_C: dict[float, np.ndarray] = {}

    for C in C_GRID:
        oof = np.full(len(y), np.nan)
        for train_idx, val_idx in folds:
            # Standardiser refit inside each fold: the means and stds are
            # themselves learned parameters and must not see the validation rows.
            std = F.Standardizer.fit(X.iloc[train_idx])
            model = _fit(C, std.transform(X.iloc[train_idx]), y[train_idx])
            oof[val_idx] = model.decision_function(std.transform(X.iloc[val_idx]))
        history[C] = float(average_precision_score(y, oof))
        oof_by_C[C] = oof
        print(f"[fleur]   C={C:<6} cv average precision = {history[C]:.4f}")

    best_C = max(history, key=lambda c: history[c])
    return best_C, history, oof_by_C[best_C]


def pick_threshold(y: np.ndarray, probabilities: np.ndarray) -> tuple[float, float, float]:
    """TR-6: highest precision among thresholds that still reach 35% recall."""
    precision, recall, thresholds = precision_recall_curve(y, probabilities)
    # precision_recall_curve returns one more point than thresholds.
    precision, recall = precision[:-1], recall[:-1]
    eligible = recall >= MIN_RECALL
    if not eligible.any():
        idx = int(np.argmax(recall))
    else:
        candidates = np.where(eligible)[0]
        idx = int(candidates[np.argmax(precision[candidates])])
    return float(thresholds[idx]), float(precision[idx]), float(recall[idx])


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the Fleur flare classifier")
    parser.add_argument("--panel", type=Path, default=DATA_DIR / "synthetic_panel.csv")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)

    print("[fleur] building feature matrix ...")
    panel = pd.read_csv(args.panel)
    X, y_series, groups_series, _dates = F.build_dataset(panel)
    y = y_series.to_numpy()
    groups = groups_series.to_numpy()

    # TR-1: split by patient. Splitting by row would let the same person's
    # adjacent days sit on both sides and produce a beautiful, meaningless score.
    is_train = groups <= TRAIN_PATIENT_MAX
    X_train, X_test = X[is_train], X[~is_train]
    y_train, y_test = y[is_train], y[~is_train]
    g_train = groups[is_train]

    print(
        f"[fleur] train {X_train.shape[0]:,} rows / {len(set(g_train))} patients, "
        f"test {X_test.shape[0]:,} rows / {len(set(groups[~is_train]))} patients"
    )
    print(f"[fleur] positive rate: train {y_train.mean():.4f}, test {y_test.mean():.4f}")

    print("[fleur] selecting C by grouped CV ...")
    best_C, cv_history, oof_scores = select_C(X_train, y_train, g_train)
    print(f"[fleur] best C = {best_C}")

    standardizer = F.Standardizer.fit(X_train)
    model = _fit(best_C, standardizer.transform(X_train), y_train)

    # SPEC-DEVIATION: `class_weight='balanced'` (TR-5) reweights the classes to 50/50, which
    # makes the fitted probabilities far larger than any real person's risk.
    # The ranking is what the model learned; the offset is an artefact of the
    # reweighting. Shifting the intercept by the log prior odds undoes exactly
    # that artefact, leaving ranking — and therefore average precision —
    # untouched while making the number on the Today screen mean what it says.
    prior = float(y_train.mean())
    prior_shift = float(np.log(prior / (1.0 - prior)))
    intercept = float(model.intercept_[0]) + prior_shift
    coefficients = model.coef_[0].astype(float)

    def probabilities(matrix: pd.DataFrame) -> np.ndarray:
        z = standardizer.transform(matrix) @ coefficients + intercept
        return 1.0 / (1.0 + np.exp(-z))

    oof_probabilities = 1.0 / (1.0 + np.exp(-(oof_scores + prior_shift)))
    threshold, cv_precision, cv_recall = pick_threshold(y_train, oof_probabilities)
    print(
        f"[fleur] threshold {threshold:.4f} "
        f"(cv precision {cv_precision:.3f}, recall {cv_recall:.3f})"
    )

    test_probabilities = probabilities(X_test)
    predicted = (test_probabilities >= threshold).astype(int)
    metrics = {
        "average_precision": float(average_precision_score(y_test, test_probabilities)),
        "roc_auc": float(roc_auc_score(y_test, test_probabilities)),
        "precision_at_threshold": float(
            predicted[predicted == 1].size
            and (y_test[predicted == 1].sum() / predicted.sum())
        ),
        "recall_at_threshold": float(y_test[predicted == 1].sum() / max(y_test.sum(), 1)),
        "base_rate": float(y_test.mean()),
        "n_train_patients": int(len(set(g_train))),
        "n_test_patients": int(len(set(groups[~is_train]))),
        "n_train_rows": int(len(y_train)),
        "n_test_rows": int(len(y_test)),
        "best_C": best_C,
        "nonzero_coefficients": int((coefficients != 0).sum()),
    }
    metrics["lift_over_base_rate"] = metrics["average_precision"] / metrics["base_rate"]

    print(
        f"[fleur] test AP {metrics['average_precision']:.4f} "
        f"({metrics['lift_over_base_rate']:.1f}x base rate), "
        f"precision {metrics['precision_at_threshold']:.3f}, "
        f"recall {metrics['recall_at_threshold']:.3f}, "
        f"{metrics['nonzero_coefficients']} nonzero coefficients"
    )

    print("[fleur] running VAL-1..VAL-4 ...")
    ground_truth = V.load_ground_truth()
    test_patients = set(int(p) for p in set(groups[~is_train]))
    results = {
        "val1": V.trigger_recovery(
            list(X.columns), coefficients, ground_truth, test_patients
        ),
        "val2": V.leakage_test(
            X_train, y_train, X_test, y_test, best_C, metrics["average_precision"]
        ),
        "val3": V.null_test(X_train, y_train, X_test, y_test, best_C),
        "val4": V.temporal_sanity(panel),
    }
    for name, res in results.items():
        print(f"[fleur]   {name}: {'PASS' if res['passes'] else 'FAIL'}")

    _figures(y_test, test_probabilities, predicted, threshold, X, coefficients,
             standardizer, X_train, y_train, cv_history)

    np.savez(
        OUT_DIR / "trained.npz",
        feature_names=np.array(list(X.columns)),
        coefficients=coefficients,
        means=standardizer.means,
        stds=standardizer.stds,
        intercept=intercept,
        threshold=threshold,
    )
    with (OUT_DIR / "metrics.json").open("w") as fh:
        json.dump({"metrics": metrics, "cv": cv_history, "validation": results}, fh, indent=2)

    _write_report(metrics, cv_history, results, X, coefficients, threshold, ground_truth)
    _check_acceptance(metrics, results)


def _check_acceptance(metrics: dict, results: dict) -> None:
    print("\n[fleur] §8.3 acceptance criteria")
    checks = [
        ("average precision >= 0.30", metrics["average_precision"], TARGETS["average_precision"]),
        ("precision >= 0.55", metrics["precision_at_threshold"], TARGETS["precision_at_threshold"]),
        ("recall >= 0.35", metrics["recall_at_threshold"], TARGETS["recall_at_threshold"]),
        ("planted-trigger share >= 0.60", results["val1"]["selected_precision"],
         TARGETS["trigger_precision"]),
    ]
    all_ok = True
    for label, actual, target in checks:
        ok = actual >= target
        all_ok &= ok
        print(f"  [{'PASS' if ok else 'FAIL'}] {label:<32} actual {actual:.4f}")
    for key in ("val1", "val2", "val3", "val4"):
        ok = results[key]["passes"]
        all_ok &= ok
        print(f"  [{'PASS' if ok else 'FAIL'}] {key.upper()}")
    print(f"\n[fleur] M2 exit criteria: {'MET' if all_ok else 'NOT MET'}")


def _figures(
    y_test: np.ndarray,
    probabilities: np.ndarray,
    predicted: np.ndarray,
    threshold: float,
    X: pd.DataFrame,
    coefficients: np.ndarray,
    standardizer: F.Standardizer,
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    cv_history: dict,
) -> None:
    precision, recall, _ = precision_recall_curve(y_test, probabilities)
    fig, ax = plt.subplots(figsize=(5.5, 4.2))
    ax.plot(recall, precision, color="#5B6BD6", lw=2)
    ax.axhline(y_test.mean(), ls="--", lw=1, color="#999",
               label=f"base rate {y_test.mean():.3f}")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-recall, held-out patients")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIG_DIR / "pr_curve.png", dpi=150)
    plt.close(fig)

    cm = confusion_matrix(y_test, predicted)
    fig, ax = plt.subplots(figsize=(4.2, 3.8))
    ax.imshow(cm, cmap="Blues")
    for (i, j), v in np.ndenumerate(cm):
        ax.text(j, i, f"{v:,}", ha="center", va="center",
                color="white" if v > cm.max() / 2 else "black")
    ax.set_xticks([0, 1], ["no flare", "flare"])
    ax.set_yticks([0, 1], ["no flare", "flare"])
    ax.set_xlabel("predicted")
    ax.set_ylabel("actual")
    ax.set_title(f"Confusion matrix @ {threshold:.3f}")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "confusion_matrix.png", dpi=150)
    plt.close(fig)

    order = np.argsort(-np.abs(coefficients))[:15]
    order = [i for i in order if coefficients[i] != 0][::-1]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.barh(
        [X.columns[i] for i in order],
        [coefficients[i] for i in order],
        color=["#C96A5B" if coefficients[i] > 0 else "#5B93C9" for i in order],
    )
    ax.axvline(0, color="#333", lw=0.8)
    ax.set_xlabel("standardised coefficient")
    ax.set_title("Top 15 features by |coefficient|")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "coefficients.png", dpi=150)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5, 3.6))
    ax.plot(list(cv_history), list(cv_history.values()), "o-", color="#5B6BD6")
    ax.set_xscale("log")
    ax.set_xlabel("C (inverse regularisation)")
    ax.set_ylabel("CV average precision")
    ax.set_title("Hyperparameter sweep")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "c_sweep.png", dpi=150)
    plt.close(fig)

    # §5.2 secondary model: an explanation figure only. Never shipped.
    tree = DecisionTreeClassifier(max_depth=3, class_weight="balanced", random_state=0)
    tree.fit(standardizer.transform(X_train), y_train)
    fig, ax = plt.subplots(figsize=(15, 7))
    plot_tree(tree, feature_names=list(X.columns), class_names=["no flare", "flare"],
              filled=True, fontsize=7, ax=ax, impurity=False)
    ax.set_title("Depth-3 decision tree — illustration for the writeup, not shipped")
    fig.tight_layout()
    fig.savefig(FIG_DIR / "decision_tree.png", dpi=130)
    plt.close(fig)


def _write_report(
    metrics: dict,
    cv_history: dict,
    results: dict,
    X: pd.DataFrame,
    coefficients: np.ndarray,
    threshold: float,
    ground_truth: dict,
) -> None:
    lines = [
        "# Fleur — model report",
        "",
        f"Model: L1 logistic regression (§8.4), C={metrics['best_C']}, "
        f"threshold={threshold:.4f}",
        f"Data: {ground_truth['n_patients']} simulated patients, "
        f"weather source `{ground_truth['weather_source']}`, seed {ground_truth['seed']}",
        "",
        "## Held-out performance (§8.3)",
        "",
        "| Metric | Value | Target |",
        "|---|---|---|",
        f"| Average precision | {metrics['average_precision']:.4f} | >= 0.30 |",
        f"| Precision @ threshold | {metrics['precision_at_threshold']:.4f} | >= 0.55 |",
        f"| Recall @ threshold | {metrics['recall_at_threshold']:.4f} | >= 0.35 |",
        f"| ROC AUC | {metrics['roc_auc']:.4f} | (not the selection metric) |",
        f"| Base rate | {metrics['base_rate']:.4f} | — |",
        f"| Lift over base rate | {metrics['lift_over_base_rate']:.2f}x | ~3x |",
        f"| Nonzero coefficients | {metrics['nonzero_coefficients']} / {len(coefficients)} | — |",
        "",
        "Rows: "
        f"{metrics['n_train_rows']:,} train ({metrics['n_train_patients']} patients), "
        f"{metrics['n_test_rows']:,} test ({metrics['n_test_patients']} patients). "
        "Split is by patient (TR-1).",
        "",
        "## Hyperparameter sweep (TR-3)",
        "",
        "| C | CV average precision |",
        "|---|---|",
    ]
    for C, ap in cv_history.items():
        marker = " **(selected)**" if C == metrics["best_C"] else ""
        lines.append(f"| {C} | {ap:.4f}{marker} |")

    lines += ["", "## Coefficients", "", "| Feature | Coefficient |", "|---|---|"]
    order = np.argsort(-np.abs(coefficients))
    for i in order:
        if coefficients[i] == 0:
            continue
        lines.append(f"| `{X.columns[i]}` | {coefficients[i]:+.4f} |")

    lines += ["", V.format_report(results)]
    (OUT_DIR / "report.md").write_text("\n".join(lines))
    print(f"[fleur] wrote {OUT_DIR / 'report.md'}")


if __name__ == "__main__":
    main()
