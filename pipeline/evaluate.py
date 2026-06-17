"""
evaluate.py — Cálculo padronizado das métricas de avaliação.

PBL — porquê: para julgar churn (classe desbalanceada, ~26,5%), a acurácia
engana. Usamos ROC-AUC (ranqueamento independente de threshold), PR-AUC
(sensível à classe positiva rara), recall da classe churn (não perder quem vai
sair), F1 (equilíbrio) e lift no decil superior (quão melhor que o acaso a
priorização fica). Centralizar isso garante que treino/val/teste sejam medidos
do mesmo jeito.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def lift_at_decile(y_true, y_prob, decile: float = 0.1) -> float:
    """Lift no topo `decile` (default decil superior, 10%)."""
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)
    n = len(y_true)
    k = max(1, int(np.ceil(n * decile)))
    order = np.argsort(-y_prob)
    top_idx = order[:k]
    base_rate = y_true.mean()
    top_rate = y_true[top_idx].mean()
    return float(top_rate / base_rate) if base_rate > 0 else 0.0


def compute_metrics(y_true, y_prob, threshold: float = 0.5) -> dict:
    """Dicionário completo de métricas para um conjunto."""
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)
    y_pred = (y_prob >= threshold).astype(int)
    return {
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 4),
        "pr_auc": round(float(average_precision_score(y_true, y_prob)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "lift_top_decile": round(lift_at_decile(y_true, y_prob, 0.1), 4),
        "threshold": round(float(threshold), 4),
        "n": int(len(y_true)),
        "positive_rate": round(float(y_true.mean()), 4),
    }
