"""
train_mvp.py — Baseline (MVP) do modelo de churn.

PBL — porquê: antes de partir para um modelo sofisticado (XGBoost + Optuna),
estabelecemos uma linha de base honesta com modelos simples e interpretáveis
(LogisticRegression balanceada + RandomForest). Isso (a) dá um piso de
referência, (b) valida o pipeline de dados/pré-processamento ponta a ponta, e
(c) evita "complexidade prematura". Meta MVP: ROC-AUC >= 0,75.

Split estratificado 70/15/15 (treino/val/teste). O pré-processador é fit
SOMENTE no treino (anti-leakage) e reaplicado em val/teste.
"""
from __future__ import annotations

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

from . import config
from .data_loader import load_data
from .evaluate import compute_metrics
from .features import add_derived_features
from .preprocessing import build_preprocessor


def make_splits(df, feature_list):
    """Split estratificado 70/15/15 reprodutível."""
    X = df[feature_list]
    y = df[config.TARGET]
    # 1º corte: 70% treino, 30% temporário.
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=config.SEED
    )
    # 2º corte: divide o temp em metade val / metade teste (15% cada).
    X_val, X_te, y_val, y_te = train_test_split(
        X_tmp, y_tmp, test_size=0.50, stratify=y_tmp, random_state=config.SEED
    )
    return X_tr, X_val, X_te, y_tr, y_val, y_te


def run(verbose: bool = True) -> dict:
    feats = config.model_feature_list()
    df = add_derived_features(load_data())
    X_tr, X_val, X_te, y_tr, y_val, y_te = make_splits(df, feats)

    pre = build_preprocessor(feats)
    X_tr_t = pre.fit_transform(X_tr)   # FIT só no treino
    X_val_t = pre.transform(X_val)
    X_te_t = pre.transform(X_te)

    models = {
        "logreg": LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=config.SEED
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=300, class_weight="balanced",
            random_state=config.SEED, n_jobs=-1
        ),
    }

    results = {}
    for name, clf in models.items():
        clf.fit(X_tr_t, y_tr)
        p_tr = clf.predict_proba(X_tr_t)[:, 1]
        p_val = clf.predict_proba(X_val_t)[:, 1]
        p_te = clf.predict_proba(X_te_t)[:, 1]
        results[name] = {
            "train": compute_metrics(y_tr, p_tr),
            "val": compute_metrics(y_val, p_val),
            "test": compute_metrics(y_te, p_te),
        }

    if verbose:
        print("=" * 70)
        print("MVP — BASELINE (meta: ROC-AUC >= 0.75)")
        print("=" * 70)
        for name, r in results.items():
            print(f"\n[{name}]")
            for split in ("train", "val", "test"):
                m = r[split]
                print(
                    f"  {split:5s}  ROC-AUC={m['roc_auc']:.4f}  PR-AUC={m['pr_auc']:.4f}  "
                    f"recall={m['recall']:.4f}  F1={m['f1']:.4f}"
                )
            ok = r["test"]["roc_auc"] >= 0.75
            print(f"  -> meta ROC-AUC>=0.75 no teste: {'OK' if ok else 'FALHOU'}")
        print("=" * 70)

    return results


if __name__ == "__main__":
    run(verbose=True)
