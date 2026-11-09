"""
predictor.py — scores a child's game log with the trained Random Forest (v2).

The model was trained on task-agnostic summary features (see aggregate_features),
so it works with any levelled game that logs clicks / hits / misses per level.
"""
import pickle
import threading
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

MODEL_PATH = Path(__file__).parent / "artifacts" / "rf_dyslexia_agg_model.pkl"
MIN_LEVELS = 6  # must match the training notebook


def aggregate_features(tasks, age):
    """IDENTICAL to the function used in the Colab notebook.
    tasks = ordered list of (clicks, hits, misses), one tuple per level played.
    Returns None if fewer than MIN_LEVELS levels were attempted."""
    t = [x for x in tasks if x[0] is not None and not np.isnan(x[0]) and x[0] > 0]
    if len(t) < MIN_LEVELS:
        return None
    clicks = np.array([x[0] for x in t], dtype=float)
    hits = np.nan_to_num(np.array([x[1] for x in t], dtype=float))
    misses = np.nan_to_num(np.array([x[2] for x in t], dtype=float))
    acc = np.clip(hits / clicks, 0, 1)
    early, mid, late = [np.clip(hits[i].sum() / clicks[i].sum(), 0, 1)
                        for i in np.array_split(np.arange(len(t)), 3)]
    return {
        "Age": age,
        "overall_accuracy": np.clip(hits.sum() / clicks.sum(), 0, 1),
        "overall_missrate": np.clip(misses.sum() / clicks.sum(), 0, 1),
        "mean_task_accuracy": acc.mean(),
        "std_task_accuracy": acc.std(),
        "low_accuracy_share": (acc < 0.5).mean(),
        "early_accuracy": early,
        "mid_accuracy": mid,
        "late_accuracy": late,
        "late_minus_early": late - early,
        "mean_clicks_per_task": clicks.mean(),
        "std_clicks_per_task": clicks.std(),
    }


# Loaded on first use (not at import), so a missing or mismatched model file
# can't stop `manage.py runserver` from starting.
_lock = threading.Lock()


@lru_cache(maxsize=1)
def _bundle():
    import shap
    with _lock:
        with open(MODEL_PATH, "rb") as f:
            b = pickle.load(f)  # only ever load a file you created yourself
        b["explainer"] = shap.TreeExplainer(b["model"])
        return b


def _risk_band(prob, threshold):
    """Bands are relative to the screening threshold chosen in Colab."""
    if prob < threshold:
        return "low"
    if prob < 2 * threshold:
        return "elevated"
    return "high"


def score(levels, age, top_n=3):
    """
    levels: ordered list of {"clicks": int, "hits": int, "misses": int}
    age:    child's age in years
    Returns a dict that can be stored as JSON and shown on the dashboards.
    Raises ValueError if there are too few completed levels.
    """
    b = _bundle()
    feats = aggregate_features(
        [(l["clicks"], l["hits"], l["misses"]) for l in levels], age
    )
    if feats is None:
        raise ValueError(f"At least {MIN_LEVELS} completed levels are needed.")

    row = pd.DataFrame([feats])[b["features"]].fillna(b["medians"])
    prob = float(b["model"].predict_proba(row)[0, 1])

    # SHAP values for the "dyslexia" class (handles old and new shap output shapes)
    sv = b["explainer"].shap_values(row)
    if isinstance(sv, list):
        vals = sv[1][0]
    elif sv.ndim == 3:
        vals = sv[0, :, 1]
    else:
        vals = sv[0]

    order = np.argsort(-np.abs(vals))[:top_n]
    drivers = [{
        "feature": b["features"][i],
        "label": b["feature_labels"].get(b["features"][i], b["features"][i]),
        "value": round(float(row.iloc[0, i]), 3),
        "effect": "raises" if vals[i] > 0 else "lowers",
        "shap": round(float(vals[i]), 4),
    } for i in order]

    return {
        "probability": round(prob, 4),
        "threshold": round(float(b["threshold"]), 4),
        "flagged": prob >= b["threshold"],
        "band": _risk_band(prob, b["threshold"]),
        "drivers": drivers,
        "features": {k: round(float(v), 4) for k, v in feats.items()},
    }