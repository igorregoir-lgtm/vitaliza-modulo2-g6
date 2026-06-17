"""
inference.py — Pipeline de INFERÊNCIA (separado do treino).

PBL — porquê: o requisito normativo (Trilha S9, slide 12) exige separar treino
de inferência e servir a partir de artefatos serializados (joblib). Este módulo
NÃO importa nada de treino (Optuna, etc.): carrega model.joblib + preprocess.joblib
UMA vez, aplica EXATAMENTE o mesmo pré-processamento do treino (anti-leakage) e
devolve o pacote de decisão. É o que a Vercel Python Function chama.

Contrato de saída de predict():
  {
    churn_probability: float (calibrada),
    risk_tier: 'baixo'|'medio'|'alto',
    threshold: float,
    top_drivers: [str],
    shap_local: {base_value, contributions, top_drivers},
    archetype: {archetype, proactive_allowed, lever, policy, ...},
    model_version: str
  }
"""
from __future__ import annotations

import joblib
import numpy as np
import pandas as pd

from . import config
from .archetypes import classify_archetype
from .features import add_derived_features

# Carga única (cold start) — reaproveitada em chamadas subsequentes.
_BUNDLE = None
_PRE = None
_EXPLAINER = None


def _ensure_loaded():
    global _BUNDLE, _PRE, _EXPLAINER
    if _BUNDLE is None:
        _BUNDLE = joblib.load(config.MODEL_PATH)
        _PRE = joblib.load(config.PREPROCESS_PATH)
        # SHAP é opcional na inferência; importado tardiamente para não ser
        # dependência dura caso indisponível no ambiente serverless.
        try:
            import shap
            _EXPLAINER = shap.TreeExplainer(_BUNDLE["tree_model"])
        except Exception:
            _EXPLAINER = None
    return _BUNDLE, _PRE, _EXPLAINER


def _transform(features_dict: dict, pre):
    raw = {f: features_dict.get(f, 0) for f in config.RAW_FEATURES}
    df = add_derived_features(pd.DataFrame([raw]))
    feats = config.model_feature_list()
    return df, pre.transform(df[feats])


def _local_shap(Xt, explainer, feature_order, derived_df):
    if explainer is None:
        return None
    sv = explainer.shap_values(Xt)
    if isinstance(sv, list):
        sv = sv[-1]
    sv = np.asarray(sv).reshape(-1)
    base = explainer.expected_value
    if isinstance(base, (list, np.ndarray)):
        base = float(np.asarray(base).reshape(-1)[-1])
    else:
        base = float(base)

    contribs = []
    for i, fname in enumerate(feature_order):
        val = float(derived_df.iloc[0][fname]) if fname in derived_df.columns else None
        contribs.append({
            "feature": fname,
            "shap_value": round(float(sv[i]), 5),
            "value": round(val, 4) if val is not None else None,
            "actionable": bool(config.ACTIONABLE_FEATURES.get(fname, False)),
            "direction": "aumenta_risco" if sv[i] > 0 else ("reduz_risco" if sv[i] < 0 else "neutro"),
        })
    contribs.sort(key=lambda c: abs(c["shap_value"]), reverse=True)
    return {
        "base_value": round(base, 5),
        "contributions": contribs,
        "top_drivers": [c["feature"] for c in contribs[:5]],
    }


def predict(features_dict: dict) -> dict:
    """Inferência completa para um usuário."""
    bundle, pre, explainer = _ensure_loaded()
    model = bundle["calibrated_model"]
    threshold = bundle["threshold"]
    feature_order = bundle["feature_names_out"]

    derived_df, Xt = _transform(features_dict, pre)
    prob = float(model.predict_proba(Xt)[0, 1])
    tier = config.risk_tier(prob)

    shap_local = _local_shap(Xt, explainer, feature_order, derived_df)
    contribs = shap_local["contributions"] if shap_local else []
    top_drivers = shap_local["top_drivers"] if shap_local else []

    archetype = classify_archetype(features_dict, prob, contribs)

    return {
        "churn_probability": round(prob, 4),
        "risk_tier": tier,
        "threshold": round(float(threshold), 4),
        "predicted_churn": bool(prob >= threshold),
        "top_drivers": top_drivers,
        "shap_local": shap_local,
        "archetype": archetype,
        "model_version": bundle.get("model_version", config.MODEL_VERSION),
    }


if __name__ == "__main__":
    import json

    examples = {
        "churn_obvio (early dropper, freq despencando)": {
            "gender": 1, "Near_Location": 0, "Partner": 0, "Promo_friends": 0,
            "Phone": 1, "Contract_period": 1, "Group_visits": 0, "Age": 23,
            "Avg_additional_charges_total": 12.0, "Month_to_end_contract": 1.0,
            "Lifetime": 1, "Avg_class_frequency_total": 1.2,
            "Avg_class_frequency_current_month": 0.1,
        },
        "stay_obvio (engajado, contrato anual)": {
            "gender": 0, "Near_Location": 1, "Partner": 1, "Promo_friends": 1,
            "Phone": 1, "Contract_period": 12, "Group_visits": 1, "Age": 35,
            "Avg_additional_charges_total": 180.0, "Month_to_end_contract": 11.0,
            "Lifetime": 10, "Avg_class_frequency_total": 2.8,
            "Avg_class_frequency_current_month": 3.0,
        },
        "sleeping_dog (antigo, hoje inativo)": {
            "gender": 1, "Near_Location": 1, "Partner": 0, "Promo_friends": 0,
            "Phone": 1, "Contract_period": 12, "Group_visits": 0, "Age": 40,
            "Avg_additional_charges_total": 90.0, "Month_to_end_contract": 2.0,
            "Lifetime": 9, "Avg_class_frequency_total": 1.6,
            "Avg_class_frequency_current_month": 0.2,
        },
    }
    for label, feats in examples.items():
        out = predict(feats)
        print("=" * 70)
        print(label)
        print(f"  churn_probability: {out['churn_probability']}  tier: {out['risk_tier']}  "
              f"predicted_churn: {out['predicted_churn']}")
        print(f"  archetype: {out['archetype']['archetype']}  "
              f"(proactive_allowed={out['archetype']['proactive_allowed']})")
        print(f"  top_drivers: {out['top_drivers']}")
