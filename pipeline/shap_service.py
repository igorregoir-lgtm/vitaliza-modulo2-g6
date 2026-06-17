"""
shap_service.py — Explicabilidade com SHAP (global + local).

PBL — porquê: um modelo que acerta mas não explica é uma caixa-preta inauditável.
SHAP decompõe cada previsão em contribuições aditivas por feature (valor de
Shapley), respondendo "quais variáveis pesaram neste caso". Usamos o
TreeExplainer sobre o modelo TREE pré-calibração (a calibração é monotônica e
não muda o ranqueamento dos drivers; o TreeExplainer exige a árvore crua).

Guardrail (Semana 9): SHAP explica o MODELO, não causalidade do mundo real.

Produz:
  - artifacts/shap_summary.png  (beeswarm global)
  - artifacts/shap_bar.png      (importância média |SHAP|)
  - artifacts/shap_global.json  (mean|shap| por feature)
  - artifacts/shap_waterfall_example.png (exemplo local)
  - explain_local(features_dict) -> dict com base_value, contributions, top_drivers
"""
from __future__ import annotations

import json

import joblib
import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import shap  # noqa: E402

from . import config  # noqa: E402
from .data_loader import load_data  # noqa: E402
from .features import add_derived_features  # noqa: E402

_BUNDLE = None
_PRE = None
_EXPLAINER = None


def _load():
    global _BUNDLE, _PRE, _EXPLAINER
    if _BUNDLE is None:
        _BUNDLE = joblib.load(config.MODEL_PATH)
        _PRE = joblib.load(config.PREPROCESS_PATH)
        _EXPLAINER = shap.TreeExplainer(_BUNDLE["tree_model"])
    return _BUNDLE, _PRE, _EXPLAINER


def _feature_direction(shap_value: float) -> str:
    """Direção do empurrão: aumenta ou reduz o risco de churn."""
    if shap_value > 0:
        return "aumenta_risco"
    if shap_value < 0:
        return "reduz_risco"
    return "neutro"


def _transform_one(features_dict: dict, pre, feature_order) -> np.ndarray:
    """Aplica derivadas + pré-processador a 1 registro, na ordem do modelo."""
    raw = {f: features_dict.get(f, 0) for f in config.RAW_FEATURES}
    df = pd.DataFrame([raw])
    df = add_derived_features(df)
    feats = config.model_feature_list()
    Xt = pre.transform(df[feats])
    return Xt


def explain_local(features_dict: dict) -> dict:
    """Explicação local SHAP para um único usuário.

    Returns
    -------
    dict {base_value, contributions:[{feature, shap_value, value, actionable,
          direction}], top_drivers}
    """
    bundle, pre, explainer = _load()
    feature_order = bundle["feature_names_out"]
    Xt = _transform_one(features_dict, pre, feature_order)

    sv = explainer.shap_values(Xt)
    if isinstance(sv, list):  # algumas versões devolvem lista por classe
        sv = sv[-1]
    sv = np.asarray(sv).reshape(-1)
    base = explainer.expected_value
    if isinstance(base, (list, np.ndarray)):
        base = float(np.asarray(base).reshape(-1)[-1])
    else:
        base = float(base)

    # valores originais (pré-transform) por feature, para leitura humana
    raw = {f: features_dict.get(f, 0) for f in config.RAW_FEATURES}
    derived_df = add_derived_features(pd.DataFrame([raw]))

    contribs = []
    for i, fname in enumerate(feature_order):
        val = float(derived_df.iloc[0][fname]) if fname in derived_df.columns else None
        contribs.append({
            "feature": fname,
            "shap_value": round(float(sv[i]), 5),
            "value": round(val, 4) if val is not None else None,
            "actionable": bool(config.ACTIONABLE_FEATURES.get(fname, False)),
            "direction": _feature_direction(float(sv[i])),
        })

    contribs_sorted = sorted(contribs, key=lambda c: abs(c["shap_value"]), reverse=True)
    top_drivers = [c["feature"] for c in contribs_sorted[:5]]

    return {
        "base_value": round(base, 5),
        "contributions": contribs_sorted,
        "top_drivers": top_drivers,
    }


def build_global_artifacts(verbose: bool = True) -> dict:
    """Gera os PNGs globais e o shap_global.json (sobre uma amostra do dataset)."""
    bundle, pre, explainer = _load()
    feature_order = bundle["feature_names_out"]

    df = add_derived_features(load_data())
    feats = config.model_feature_list()
    # amostra para o summary (determinística)
    sample = df.sample(min(1000, len(df)), random_state=config.SEED)
    Xt = pre.transform(sample[feats])

    sv = explainer.shap_values(Xt)
    if isinstance(sv, list):
        sv = sv[-1]
    sv = np.asarray(sv)

    # DataFrame nomeado para os plots
    X_named = pd.DataFrame(Xt, columns=feature_order)

    # beeswarm (summary)
    plt.figure()
    shap.summary_plot(sv, X_named, show=False, max_display=len(feature_order))
    plt.tight_layout()
    plt.savefig(config.SHAP_SUMMARY_PNG, dpi=110, bbox_inches="tight")
    plt.close()

    # bar (importância média)
    plt.figure()
    shap.summary_plot(sv, X_named, plot_type="bar", show=False,
                      max_display=len(feature_order))
    plt.tight_layout()
    plt.savefig(config.SHAP_BAR_PNG, dpi=110, bbox_inches="tight")
    plt.close()

    # mean|shap| por feature
    mean_abs = np.abs(sv).mean(axis=0)
    global_imp = {
        feature_order[i]: round(float(mean_abs[i]), 5)
        for i in range(len(feature_order))
    }
    global_imp = dict(sorted(global_imp.items(), key=lambda kv: kv[1], reverse=True))
    with open(config.SHAP_GLOBAL_JSON, "w", encoding="utf-8") as f:
        json.dump(global_imp, f, indent=2, ensure_ascii=False)

    # exemplo local — waterfall de um usuário de alto risco do dataset
    high_risk = sample.sort_values("Avg_class_frequency_current_month").iloc[0]
    ex_dict = {f: float(high_risk[f]) for f in config.RAW_FEATURES}
    _waterfall_png(ex_dict, explainer, pre, feature_order)

    if verbose:
        print("Top-5 SHAP global (mean|shap|):")
        for k, v in list(global_imp.items())[:5]:
            print(f"  {k:38s} {v:.5f}")
        print("\nArtefatos SHAP salvos:")
        for p in (config.SHAP_SUMMARY_PNG, config.SHAP_BAR_PNG,
                  config.SHAP_GLOBAL_JSON, config.SHAP_WATERFALL_PNG):
            print(f"  - {p}")

    return global_imp


def _waterfall_png(features_dict, explainer, pre, feature_order):
    Xt = _transform_one(features_dict, pre, feature_order)
    sv = explainer.shap_values(Xt)
    if isinstance(sv, list):
        sv = sv[-1]
    sv = np.asarray(sv).reshape(-1)
    base = explainer.expected_value
    if isinstance(base, (list, np.ndarray)):
        base = float(np.asarray(base).reshape(-1)[-1])
    else:
        base = float(base)

    expl = shap.Explanation(
        values=sv,
        base_values=base,
        data=Xt.reshape(-1),
        feature_names=feature_order,
    )
    plt.figure()
    shap.plots.waterfall(expl, max_display=12, show=False)
    plt.tight_layout()
    plt.savefig(config.SHAP_WATERFALL_PNG, dpi=110, bbox_inches="tight")
    plt.close()


if __name__ == "__main__":
    build_global_artifacts(verbose=True)
    print("\nExemplo explain_local:")
    ex = {
        "gender": 1, "Near_Location": 1, "Partner": 0, "Promo_friends": 0,
        "Phone": 1, "Contract_period": 1, "Group_visits": 0, "Age": 26,
        "Avg_additional_charges_total": 30.0, "Month_to_end_contract": 1.0,
        "Lifetime": 1, "Avg_class_frequency_total": 1.0,
        "Avg_class_frequency_current_month": 0.2,
    }
    out = explain_local(ex)
    print("  base_value:", out["base_value"])
    print("  top_drivers:", out["top_drivers"])
