"""
train_final.py — Modelo final: XGBoost + Optuna + calibração + threshold por custo.

PBL — porquê (cada peça resolve um requisito da Trilha):
  - XGBoost: forte em tabular, captura interações não-lineares; serve de base
    para o SHAP TreeExplainer (explicabilidade).
  - Optuna (>=40 trials) com k-fold estratificado (k=5): busca de hiperparâmetros
    robusta e validada por validação cruzada — reduz variância da escolha e o
    risco de overfit a um único split. Maximiza ROC-AUC médio nos folds.
  - CalibratedClassifierCV: o XGBoost dá scores enviesados; calibramos (isotônica)
    para que "0,8" signifique de fato ~80% de chance de churn — essencial para
    tier de risco e ROI confiáveis.
  - Threshold por custo: em vez do 0,5 ingênuo, escolhemos o limiar que MINIMIZA
    o custo esperado (FN caro, FP barato mas não-zero) RESPEITANDO recall >= 0,70.
  - Reporta treino/val/teste para evidenciar ausência de overfit (gap pequeno).

Artefatos serializados:
  artifacts/model.joblib         -> modelo CALIBRADO final (para inferência)
  artifacts/preprocess.joblib    -> pré-processador fit no treino
  artifacts/feature_meta.json    -> metadados (features, acionáveis, threshold, ...)
  artifacts/metrics.json         -> métricas treino/val/teste + gap
  (o modelo tree pré-calibração é guardado dentro do bundle para o SHAP)
"""
from __future__ import annotations

import json
import warnings
from datetime import timezone

import joblib
import numpy as np
import optuna
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import StratifiedKFold, cross_val_score
from xgboost import XGBClassifier

from . import config
from .data_loader import dataset_sha256, load_data
from .evaluate import compute_metrics
from .features import add_derived_features
from .preprocessing import build_preprocessor, get_output_feature_names
from .train_mvp import make_splits

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)


def _base_xgb(params: dict) -> XGBClassifier:
    # scale_pos_weight trata o desbalanceamento (~26,5% churn).
    spw = params.pop("scale_pos_weight", None)
    kwargs = dict(
        random_state=config.SEED,
        n_jobs=-1,
        eval_metric="auc",
        tree_method="hist",
    )
    if spw is not None:
        kwargs["scale_pos_weight"] = spw
    kwargs.update(params)
    return XGBClassifier(**kwargs)


def tune(X_tr_t, y_tr, n_trials: int = 40) -> dict:
    """Busca Optuna maximizando ROC-AUC médio em k-fold estratificado (k=5)."""
    skf = StratifiedKFold(n_splits=config.KFOLDS, shuffle=True, random_state=config.SEED)
    neg = float((y_tr == 0).sum())
    pos = float((y_tr == 1).sum())
    base_spw = neg / pos

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 600),
            "max_depth": trial.suggest_int("max_depth", 2, 6),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0.0, 5.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
            "scale_pos_weight": trial.suggest_float(
                "scale_pos_weight", base_spw * 0.5, base_spw * 1.5
            ),
        }
        clf = _base_xgb(dict(params))
        scores = cross_val_score(
            clf, X_tr_t, y_tr, cv=skf, scoring="roc_auc", n_jobs=-1
        )
        return float(scores.mean())

    sampler = optuna.samplers.TPESampler(seed=config.SEED)
    study = optuna.create_study(direction="maximize", sampler=sampler)
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study.best_params


def choose_cost_threshold(y_true, y_prob) -> dict:
    """Escolhe o threshold que MINIMIZA o custo esperado, respeitando recall>=MIN.

    Custo = FN*COST_FN + FP*COST_FP + TP*COST_TP (TN custo 0).
    Varre thresholds e, entre os que cumprem recall>=MIN_RECALL, pega o de
    menor custo. Se nenhum cumprir (não é o caso aqui), relaxa para o de maior
    recall.
    """
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)
    grid = np.linspace(0.05, 0.95, 181)
    rows = []
    for t in grid:
        pred = (y_prob >= t).astype(int)
        tp = int(((pred == 1) & (y_true == 1)).sum())
        fp = int(((pred == 1) & (y_true == 0)).sum())
        fn = int(((pred == 0) & (y_true == 1)).sum())
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        cost = fn * config.COST_FN + fp * config.COST_FP + tp * config.COST_TP
        rows.append((float(t), cost, recall))

    feasible = [r for r in rows if r[2] >= config.MIN_RECALL]
    pool = feasible if feasible else rows
    # menor custo; desempate por maior recall
    best = min(pool, key=lambda r: (r[1], -r[2]))
    return {
        "threshold": round(best[0], 4),
        "expected_cost": round(best[1], 2),
        "recall_at_threshold": round(best[2], 4),
        "constraint_recall_min": config.MIN_RECALL,
        "feasible_region_nonempty": bool(feasible),
    }


def run(n_trials: int = 40, verbose: bool = True) -> dict:
    feats = config.model_feature_list()
    df = add_derived_features(load_data())
    X_tr, X_val, X_te, y_tr, y_val, y_te = make_splits(df, feats)

    # Pré-processador: fit SÓ no treino (anti-leakage).
    pre = build_preprocessor(feats)
    X_tr_t = pre.fit_transform(X_tr)
    X_val_t = pre.transform(X_val)
    X_te_t = pre.transform(X_te)
    out_names = get_output_feature_names(pre)

    if verbose:
        print("=" * 70)
        print(f"TREINO FINAL — Optuna ({n_trials} trials, k-fold={config.KFOLDS})")
        print("=" * 70)

    best_params = tune(X_tr_t, y_tr.values, n_trials=n_trials)
    if verbose:
        print("Melhores hiperparâmetros:")
        for k, v in best_params.items():
            print(f"  {k}: {round(v, 4) if isinstance(v, float) else v}")

    # Modelo tree final (pré-calibração) — base do SHAP TreeExplainer.
    tree_model = _base_xgb(dict(best_params))
    tree_model.fit(X_tr_t, y_tr)

    # Calibração: tenta isotônica e sigmoide via CV, escolhe a de melhor PR-AUC
    # na validação (calibração + ranqueamento).
    calibrators = {}
    for method in ("isotonic", "sigmoid"):
        cal = CalibratedClassifierCV(
            _base_xgb(dict(best_params)), method=method, cv=config.KFOLDS
        )
        cal.fit(X_tr_t, y_tr)
        p_val = cal.predict_proba(X_val_t)[:, 1]
        calibrators[method] = (cal, compute_metrics(y_val, p_val)["pr_auc"])
    best_method = max(calibrators, key=lambda m: calibrators[m][1])
    calibrated = calibrators[best_method][0]
    if verbose:
        print(f"\nCalibração escolhida: {best_method} "
              f"(PR-AUC val={calibrators[best_method][1]})")

    # Probabilidades calibradas.
    p_tr = calibrated.predict_proba(X_tr_t)[:, 1]
    p_val = calibrated.predict_proba(X_val_t)[:, 1]
    p_te = calibrated.predict_proba(X_te_t)[:, 1]

    # Threshold por custo escolhido NA VALIDAÇÃO (nunca no teste).
    thr_info = choose_cost_threshold(y_val, p_val)
    thr = thr_info["threshold"]

    metrics = {
        "train": compute_metrics(y_tr, p_tr, thr),
        "val": compute_metrics(y_val, p_val, thr),
        "test": compute_metrics(y_te, p_te, thr),
        "threshold_selection": thr_info,
        "calibration_method": best_method,
        "best_params": {k: (round(v, 6) if isinstance(v, float) else v)
                        for k, v in best_params.items()},
    }
    # Gap de overfit: treino - teste em ROC-AUC.
    gap = round(metrics["train"]["roc_auc"] - metrics["test"]["roc_auc"], 4)
    metrics["overfit_gap_train_minus_test_auc"] = gap
    metrics["overfit_verdict"] = (
        "sem overfit relevante" if abs(gap) <= 0.05 else "atenção: gap alto"
    )

    # ---------------- Serialização ----------------
    # Bundle do modelo: guardamos o calibrado (para inferência) e o tree
    # pré-calibração (para SHAP), além de nomes/threshold.
    model_bundle = {
        "calibrated_model": calibrated,
        "tree_model": tree_model,
        "feature_names_out": out_names,
        "threshold": thr,
        "calibration_method": best_method,
        "model_version": config.MODEL_VERSION,
    }
    joblib.dump(model_bundle, config.MODEL_PATH)
    joblib.dump(pre, config.PREPROCESS_PATH)

    # feature_meta.json
    actionable = {f: config.ACTIONABLE_FEATURES.get(f, False) for f in out_names}
    feature_meta = {
        "model_version": config.MODEL_VERSION,
        "trained_at": "TRAINED_OFFLINE",
        "dataset_sha256": dataset_sha256(),
        "feature_order": out_names,
        "actionable": actionable,
        "input_features_raw": feats,
        "excluded_features": config.LEAKY_FEATURES,
        "risk_tiers": {k: list(v) for k, v in config.RISK_TIERS.items()},
        "chosen_threshold": thr,
        "calibration_method": best_method,
        "cost_ratio": {
            "FN": config.COST_FN, "FP": config.COST_FP,
            "TP": config.COST_TP, "TN": config.COST_TN,
        },
        "min_recall_constraint": config.MIN_RECALL,
    }
    with open(config.FEATURE_META_PATH, "w", encoding="utf-8") as f:
        json.dump(feature_meta, f, indent=2, ensure_ascii=False)
    with open(config.METRICS_JSON, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    if verbose:
        print("\nMÉTRICAS (threshold por custo = %.3f):" % thr)
        for split in ("train", "val", "test"):
            m = metrics[split]
            print(
                f"  {split:5s}  ROC-AUC={m['roc_auc']:.4f}  PR-AUC={m['pr_auc']:.4f}  "
                f"recall={m['recall']:.4f}  prec={m['precision']:.4f}  "
                f"F1={m['f1']:.4f}  lift10={m['lift_top_decile']:.2f}"
            )
        print(f"\n  overfit gap (train-test AUC): {gap:+.4f} -> {metrics['overfit_verdict']}")
        print(f"  threshold: {thr} | recall@thr(val)={thr_info['recall_at_threshold']}")
        tgt_ok = metrics["test"]["roc_auc"] >= 0.82 and metrics["test"]["recall"] >= 0.70
        print(f"  META FINAL (ROC-AUC>=0.82 E recall>=0.70 no teste): "
              f"{'OK' if tgt_ok else 'FALHOU'}")
        print("\nArtefatos salvos em pipeline/artifacts/:")
        for p in (config.MODEL_PATH, config.PREPROCESS_PATH,
                  config.FEATURE_META_PATH, config.METRICS_JSON):
            print(f"  - {p}")
        print("=" * 70)

    return metrics


if __name__ == "__main__":
    run(n_trials=40, verbose=True)
