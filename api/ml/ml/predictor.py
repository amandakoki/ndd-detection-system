import joblib
import numpy as np
import pandas as pd
import shap
from pathlib import Path

BUNDLE = joblib.load(Path(__file__).parent / "artifacts" / "rf_dyslexia_model.pkl")
MODEL = BUNDLE["model"]
FEATURES = BUNDLE["features"]
NATIVE_ENCODER = BUNDLE["label_encoder_native"]
EXPLAINER = shap.TreeExplainer(MODEL)
POSITIVE = list(MODEL.classes_).index(1)   # column for "dyslexia = Yes"


def _to_frame(data: dict) -> pd.DataFrame:
    missing = [f for f in FEATURES if f not in data]
    if missing:
        raise ValueError(f"Missing features: {missing}")
    row = {}
    for f in FEATURES:
        v = data[f]
        if f == "Nativelang" and isinstance(v, str):
            v = NATIVE_ENCODER.transform([v])[0]      # "Yes"/"No" -> 1/0
        row[f] = float(v)
    return pd.DataFrame([row], columns=FEATURES)


def predict(data: dict) -> dict:
    X = _to_frame(data)
    risk = float(MODEL.predict_proba(X)[0][POSITIVE])
    return {"risk_score": round(risk, 3), "at_risk": risk >= 0.5}


def explain(data: dict, top_n: int = 5) -> list:
    X = _to_frame(data)
    sv = EXPLAINER.shap_values(X)
    if isinstance(sv, list):          # older shap: one array per class
        vals = sv[POSITIVE][0]
    elif sv.ndim == 3:                # newer shap: (rows, features, classes)
        vals = sv[0, :, POSITIVE]
    else:
        vals = sv[0]
    ranked = sorted(zip(FEATURES, vals), key=lambda p: abs(p[1]), reverse=True)
    return [
        {"feature": f, "impact": round(float(v), 4),
         "direction": "raises risk" if v > 0 else "lowers risk"}
        for f, v in ranked[:top_n]
    ]