"""
export_onnx.py — exporta o modelo de produção para ONNX (caminho "inferência
online leve", ADR-0017). Converte SÓ o `calibrated_model` (XGBoost + calibração
sigmoid) para ONNX; o pré-processamento (winsor→impute→scale, com Winsorizer
customizado não-conversível) é extraído para um JSON e será replicado em JS.

Saídas (em pipeline/artifacts/onnx/):
  - model.onnx                — calibrated_model
  - preprocess_params.json    — ordem das colunas + winsor/median/mean/scale + threshold

Valida numericamente: para amostras, compara prob(ONNX + preproc-from-params) vs
inference.predict() (pipeline original). Aborta se divergir.

Uso (offline, venv): .venv/Scripts/python -m pipeline.export_onnx
"""
from __future__ import annotations

import json
import os

import joblib
import numpy as np

from . import config
from .features import add_derived_features
from .inference import predict

OUT_DIR = os.path.join(config.ARTIFACTS_DIR, "onnx")
ONNX_PATH = os.path.join(OUT_DIR, "model.onnx")
PARAMS_PATH = os.path.join(OUT_DIR, "preprocess_params.json")


def extract_preprocess_params(pre) -> dict:
    """Introspecta o ColumnTransformer fitado e extrai os parâmetros escalares."""
    num_name, num_pipe, num_cols = pre.transformers_[0]
    bin_name, _bin_trans, bin_cols = pre.transformers_[1]
    num_cols = list(num_cols)
    bin_cols = list(bin_cols)
    steps = dict(num_pipe.named_steps)

    wins = steps.get("winsorize")
    winsor = {}
    if wins is not None:
        for c in wins.cols_:
            winsor[c] = {"lower": float(wins.lower_[c]), "upper": float(wins.upper_[c])}

    imp = steps["impute"]
    scl = steps["scale"]
    median = {c: float(m) for c, m in zip(num_cols, imp.statistics_)}
    mean = {c: float(m) for c, m in zip(num_cols, scl.mean_)}
    scale = {c: float(s) for c, s in zip(num_cols, scl.scale_)}

    return {
        "numeric": num_cols,
        "binary": bin_cols,
        "output_order": num_cols + bin_cols,
        "winsor": winsor,
        "median": median,
        "mean": mean,
        "scale": scale,
    }


def preprocess_from_params(features_dict: dict, p: dict) -> np.ndarray:
    """Replica winsor→impute→scale (numéricas) + passthrough (binárias) usando só
    os parâmetros extraídos — exatamente o que o JS fará."""
    raw = {f: features_dict.get(f, 0) for f in config.RAW_FEATURES}
    import pandas as pd

    df = add_derived_features(pd.DataFrame([raw])).iloc[0]
    vec = []
    for c in p["numeric"]:
        v = float(df[c])
        if c in p["winsor"]:
            v = min(max(v, p["winsor"][c]["lower"]), p["winsor"][c]["upper"])
        if np.isnan(v):
            v = p["median"][c]
        v = (v - p["mean"][c]) / p["scale"][c]
        vec.append(v)
    for c in p["binary"]:
        vec.append(float(df[c]))
    return np.array([vec], dtype=np.float32)


def convert(calibrated_model, n_features: int):
    from skl2onnx import update_registered_converter, to_onnx
    from skl2onnx.common.data_types import FloatTensorType
    from skl2onnx.common.shape_calculator import calculate_linear_classifier_output_shapes
    from onnxmltools.convert.xgboost.operator_converters.XGBoost import convert_xgboost
    from xgboost import XGBClassifier

    update_registered_converter(
        XGBClassifier,
        "XGBoostXGBClassifier",
        calculate_linear_classifier_output_shapes,
        convert_xgboost,
        options={"nocl": [True, False], "zipmap": [True, False, "columns"]},
    )
    return to_onnx(
        calibrated_model,
        initial_types=[("input", FloatTensorType([None, n_features]))],
        options={"zipmap": False},
        target_opset={"": 17, "ai.onnx.ml": 3},
    )


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    bundle = joblib.load(config.MODEL_PATH)
    pre = joblib.load(config.PREPROCESS_PATH)
    model = bundle["calibrated_model"]

    params = extract_preprocess_params(pre)
    params["threshold"] = round(float(bundle["threshold"]), 6)
    params["model_version"] = bundle.get("model_version", config.MODEL_VERSION)
    n = len(params["output_order"])

    onx = convert(model, n)
    with open(ONNX_PATH, "wb") as f:
        f.write(onx.SerializeToString())
    with open(PARAMS_PATH, "w", encoding="utf-8") as f:
        json.dump(params, f, ensure_ascii=False, indent=2)

    # ---- Validação numérica ----
    import onnxruntime as ort

    sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
    out_names = [o.name for o in sess.get_outputs()]
    # acha a saída de probabilidade (tensor 2D)
    prob_name = out_names[-1]
    for o in sess.get_outputs():
        if "prob" in o.name.lower():
            prob_name = o.name

    samples = {
        "early_dropper": {
            "gender": 1, "Near_Location": 0, "Partner": 0, "Promo_friends": 0, "Phone": 1,
            "Contract_period": 1, "Group_visits": 0, "Age": 23, "Avg_additional_charges_total": 12.0,
            "Month_to_end_contract": 1.0, "Lifetime": 1, "Avg_class_frequency_total": 1.2,
            "Avg_class_frequency_current_month": 0.1,
        },
        "engajado": {
            "gender": 0, "Near_Location": 1, "Partner": 1, "Promo_friends": 1, "Phone": 1,
            "Contract_period": 12, "Group_visits": 1, "Age": 35, "Avg_additional_charges_total": 180.0,
            "Month_to_end_contract": 11.0, "Lifetime": 10, "Avg_class_frequency_total": 2.8,
            "Avg_class_frequency_current_month": 3.0,
        },
        "sleeping_dog": {
            "gender": 1, "Near_Location": 1, "Partner": 0, "Promo_friends": 0, "Phone": 1,
            "Contract_period": 12, "Group_visits": 0, "Age": 40, "Avg_additional_charges_total": 90.0,
            "Month_to_end_contract": 2.0, "Lifetime": 9, "Avg_class_frequency_total": 1.6,
            "Avg_class_frequency_current_month": 0.2,
        },
    }
    print("=" * 64)
    print(f"ONNX: {ONNX_PATH}  ({os.path.getsize(ONNX_PATH)/1024:.0f} KB)")
    print(f"features (n={n}): {params['output_order']}")
    print(f"saídas ONNX: {out_names} | prob='{prob_name}'")
    print("-" * 64)
    max_diff = 0.0
    for label, feats in samples.items():
        ref = predict(feats)["churn_probability"]
        X = preprocess_from_params(feats, params)
        res = sess.run([prob_name], {"input": X})[0]
        onnx_prob = float(np.asarray(res).reshape(-1)[-1])  # coluna da classe 1
        diff = abs(onnx_prob - ref)
        max_diff = max(max_diff, diff)
        print(f"  {label:14s} ref={ref:.5f}  onnx={onnx_prob:.5f}  diff={diff:.6f}")
    print("-" * 64)
    ok = max_diff < 1e-3
    print(f"max diff = {max_diff:.6f}  =>  {'OK (bate com producao)' if ok else 'DIVERGE!'}")
    print("=" * 64)
    if not ok:
        raise SystemExit("ONNX diverge do pipeline original — abortando.")


if __name__ == "__main__":
    main()
