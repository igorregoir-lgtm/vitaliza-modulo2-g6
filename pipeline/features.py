"""
features.py — Engenharia de features derivadas (case-críticas Vitaliza).

PBL — porquê: o churn de academia raramente é explicado por uma única coluna
crua. O que importa é o *movimento* do engajamento. Por isso derivamos:

- ratio_freq_atual_vs_lifetime: frequência do mês corrente ÷ frequência média
  histórica. < 1 sinaliza queda de engajamento (sintoma clássico de pré-churn).
- delta_freq: diferença absoluta (corrente − histórica). Negativo = desacelerando.
- flag_early_user: Lifetime <= 1 (recém-chegado, alto risco de desistência inicial).
- flag_sleeping_dog: Lifetime > 6 E freq corrente < 0,5 — o "cão que dorme":
  cliente antigo, hoje inativo. NÃO deve receber campanha proativa (ADR-0008).
- contract_x_lifetime: interação contrato×tempo — captura que o efeito do tempo
  de casa depende do tipo de contrato (anual vs mensal).

Importante: estas features NÃO usam o alvo nem nenhuma informação de futuro;
são puramente do estado atual do cliente, logo são leakage-safe.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _safe_divide(num: pd.Series, den: pd.Series) -> pd.Series:
    """Divisão segura: onde o denominador é ~0, retorna 0 (sem inf/NaN)."""
    den_safe = den.replace(0, np.nan)
    out = num / den_safe
    return out.fillna(0.0)


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Adiciona as features derivadas. Não muta o input (retorna cópia)."""
    df = df.copy()

    freq_total = df["Avg_class_frequency_total"]
    freq_cur = df["Avg_class_frequency_current_month"]

    df["ratio_freq_atual_vs_lifetime"] = _safe_divide(freq_cur, freq_total)
    df["delta_freq"] = freq_cur - freq_total
    df["flag_early_user"] = (df["Lifetime"] <= 1).astype(int)
    df["flag_sleeping_dog"] = (
        (df["Lifetime"] > 6) & (df["Avg_class_frequency_current_month"] < 0.5)
    ).astype(int)
    df["contract_x_lifetime"] = df["Contract_period"] * df["Lifetime"]

    return df


def is_sleeping_dog(features: dict) -> bool:
    """Regra de negócio pontual (1 registro) — usada pela inferência/arquétipos."""
    return bool(
        features.get("Lifetime", 0) > 6
        and features.get("Avg_class_frequency_current_month", 0) < 0.5
    )


if __name__ == "__main__":
    from .data_loader import load_data

    d = add_derived_features(load_data())
    cols = [
        "ratio_freq_atual_vs_lifetime",
        "delta_freq",
        "flag_early_user",
        "flag_sleeping_dog",
        "contract_x_lifetime",
    ]
    print(d[cols].describe())
    print("\nsleeping_dogs:", int(d["flag_sleeping_dog"].sum()))
    print("early_users:", int(d["flag_early_user"].sum()))
