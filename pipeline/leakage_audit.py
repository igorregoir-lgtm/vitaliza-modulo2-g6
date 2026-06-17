"""
leakage_audit.py — Auditoria programática de vazamento (leakage).

PBL — porquê: o artefato de referência atinge AUC ~0,965, suspeitamente alto.
Antes de comemorar uma métrica, precisamos provar que o modelo não está
"trapaceando" com variáveis que carregam informação do futuro ou são proxies
quase-determinísticos do alvo. Esta auditoria é evidência, não opinião.

O que faz:
  1. Correlação de cada feature com o alvo (sinaliza proxies fortes).
  2. Análise específica de Month_to_end_contract e Lifetime (variáveis de futuro
     candidatas — "quanto falta pro contrato acabar" antecipa o desfecho).
  3. Treina o MESMO modelo COM e SEM a(s) feature(s) mais propensa(s) a leakage
     e reporta o delta de ROC-AUC no teste. Decisão baseada em evidência.
  4. Conclusão escrita por variável + decisão final do conjunto de features.

Conclusão (resumida, detalhada no model_card):
  - Month_to_end_contract: REMOVIDA. É ~ Contract_period menos o tempo já
    decorrido; correlaciona forte com o alvo e funciona como relógio de futuro.
    O ganho de AUC ao incluí-la é "barato" (quase-leakage), então abrimos mão.
  - Lifetime: MANTIDA. É o tempo de casa observável HOJE, não informação de
    futuro; é causal-plausível (early users churnam mais) e necessária para as
    flags de negócio (early_user, sleeping_dog). Não é leakage.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

from . import config
from .data_loader import load_data
from .evaluate import compute_metrics
from .features import add_derived_features
from .preprocessing import build_preprocessor


def correlation_with_target(df: pd.DataFrame) -> pd.Series:
    """Correlação de Pearson de cada feature numérica/binária com o alvo."""
    cols = config.RAW_FEATURES + config.DERIVED_NUMERIC + config.DERIVED_BINARY
    cols = [c for c in cols if c in df.columns]
    corr = df[cols + [config.TARGET]].corr()[config.TARGET].drop(config.TARGET)
    return corr.reindex(corr.abs().sort_values(ascending=False).index)


def _train_eval_auc(df: pd.DataFrame, feature_list: list[str]) -> dict:
    """Treina LogisticRegression simples e devolve métricas no teste.

    Usado para o teste A/B (com vs sem feature suspeita). Modelo leve de
    propósito: queremos isolar o efeito da feature, não otimizar o modelo.
    """
    X = df[feature_list]
    y = df[config.TARGET]
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=config.SEED
    )
    pre = build_preprocessor(feature_list)
    X_tr_t = pre.fit_transform(X_tr)
    X_te_t = pre.transform(X_te)
    clf = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=config.SEED)
    clf.fit(X_tr_t, y_tr)
    prob = clf.predict_proba(X_te_t)[:, 1]
    return compute_metrics(y_te, prob, threshold=0.5)


def future_variable_check(df: pd.DataFrame) -> dict:
    """Heurística para variáveis de 'futuro': quão determinística é a relação
    entre Month_to_end_contract e (Contract_period, Lifetime)?

    Se Month_to_end_contract ≈ f(Contract_period, tempo), ela carrega o relógio
    do contrato — informação que, no momento da predição, antecipa o desfecho.
    """
    out = {}
    # Razão média Month_to_end_contract / Contract_period por período de contrato.
    g = df.groupby("Contract_period").agg(
        mte_mean=("Month_to_end_contract", "mean"),
        mte_max=("Month_to_end_contract", "max"),
        n=("Churn", "size"),
        churn=("Churn", "mean"),
    )
    out["month_to_end_by_contract"] = g.round(3).to_dict(orient="index")
    # Correlação direta com contrato (esperado alto se for quase-determinística).
    out["corr_mte_contract"] = round(
        float(df["Month_to_end_contract"].corr(df["Contract_period"])), 4
    )
    out["corr_mte_lifetime"] = round(
        float(df["Month_to_end_contract"].corr(df["Lifetime"])), 4
    )
    return out


def run_audit(verbose: bool = True) -> dict:
    """Executa a auditoria completa e devolve um relatório estruturado."""
    df = add_derived_features(load_data())

    corr = correlation_with_target(df)
    future = future_variable_check(df)

    # Conjunto "leakage-safe" (sem Month_to_end_contract) — o que o modelo usará.
    safe_feats = config.model_feature_list()
    # Conjunto "com a feature suspeita" — adiciona Month_to_end_contract.
    leaky_feats = safe_feats + config.LEAKY_FEATURES

    m_safe = _train_eval_auc(df, safe_feats)
    m_leaky = _train_eval_auc(df, leaky_feats)
    delta_auc = round(m_leaky["roc_auc"] - m_safe["roc_auc"], 4)

    report = {
        "correlation_with_target": corr.round(4).to_dict(),
        "future_variable_check": future,
        "ab_test": {
            "features_safe": safe_feats,
            "features_with_leaky": leaky_feats,
            "auc_safe": m_safe["roc_auc"],
            "auc_with_leaky": m_leaky["roc_auc"],
            "auc_delta_leaky_minus_safe": delta_auc,
        },
        "per_feature_conclusion": {
            "Month_to_end_contract": (
                "REMOVIDA. Correlação |%.3f| com o alvo e altamente determinada por "
                "Contract_period (corr=%.3f). Funciona como relógio do contrato — "
                "informação de futuro/quase-leakage. O ganho de AUC ao incluí-la "
                "(+%.4f) não compensa o risco de inflar a métrica artificialmente."
                % (
                    abs(corr.get("Month_to_end_contract", float("nan"))),
                    future["corr_mte_contract"],
                    delta_auc,
                )
            ),
            "Lifetime": (
                "MANTIDA. Tempo de casa observável no momento da predição (não é "
                "futuro), causal-plausível (early users churnam mais) e necessária "
                "para flag_early_user e flag_sleeping_dog. Não constitui leakage."
            ),
        },
        "final_feature_set": safe_feats,
        "decision": (
            "Conjunto final = features originais SEM Month_to_end_contract + features "
            "derivadas. Defensavelmente leakage-safe: nenhuma variável de futuro, "
            "pré-processamento fit só no treino."
        ),
    }

    if verbose:
        print("=" * 70)
        print("AUDITORIA DE LEAKAGE")
        print("=" * 70)
        print("\nTop correlações |feature, alvo|:")
        for k, v in list(corr.round(4).items())[:8]:
            print(f"  {k:38s} {v:+.4f}")
        print("\nFuture-variable check (Month_to_end_contract):")
        print(f"  corr com Contract_period: {future['corr_mte_contract']}")
        print(f"  corr com Lifetime:        {future['corr_mte_lifetime']}")
        print("\nTeste A/B (LogReg, teste 30%):")
        print(f"  AUC sem leaky (safe):     {m_safe['roc_auc']}")
        print(f"  AUC com Month_to_end:     {m_leaky['roc_auc']}")
        print(f"  delta (leaky - safe):     {delta_auc:+.4f}")
        print("\nConclusões por variável:")
        for k, v in report["per_feature_conclusion"].items():
            print(f"  - {k}: {v}")
        print(f"\nDECISÃO: {report['decision']}")
        print("=" * 70)

    return report


if __name__ == "__main__":
    run_audit(verbose=True)
