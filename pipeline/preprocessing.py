"""
preprocessing.py — Pré-processamento anti-leakage, serializável.

PBL — porquê: TODO parâmetro de transformação (médias de imputação, escala,
limites de winsorização) é aprendido APENAS no conjunto de treino e reaplicado
identicamente em validação/teste/produção. Se ajustássemos no dataset inteiro,
estatísticas do teste "vazariam" para o treino e inflariam as métricas — o
clássico data leakage. Por isso usamos um sklearn Pipeline/ColumnTransformer
que guarda o estado do fit e é serializável com joblib.

Pipeline:
  - numéricas: winsorização (p99, limites do treino) → imputação (mediana) → StandardScaler
  - binárias: passthrough (já são 0/1)
A ordem das colunas de saída é fixada por `get_feature_names()` para casar com
o SHAP e a inferência.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from . import config


class Winsorizer(BaseEstimator, TransformerMixin):
    """Clipa cada coluna no percentil p (superior) e no complemento (inferior),
    aprendendo os limites SOMENTE no fit (treino). Serializável.
    """

    def __init__(self, percentile: float = 99.0, columns: list[str] | None = None):
        self.percentile = percentile
        self.columns = columns

    def fit(self, X, y=None):
        X = pd.DataFrame(X, columns=self._cols(X))
        cols = self.columns if self.columns is not None else list(X.columns)
        self.cols_ = cols
        self.upper_ = {}
        self.lower_ = {}
        for c in cols:
            self.upper_[c] = float(np.percentile(X[c].dropna(), self.percentile))
            self.lower_[c] = float(np.percentile(X[c].dropna(), 100 - self.percentile))
        return self

    def transform(self, X):
        X = pd.DataFrame(X, columns=self._cols(X)).copy()
        for c in self.cols_:
            X[c] = X[c].clip(lower=self.lower_[c], upper=self.upper_[c])
        return X.values

    def _cols(self, X):
        if isinstance(X, pd.DataFrame):
            return list(X.columns)
        # fallback para arrays — usa as colunas configuradas
        n = X.shape[1]
        return list(range(n)) if self.columns is None else self.columns[:n]


def _numeric_pipeline(numeric_features: list[str]) -> Pipeline:
    # Quais das numéricas recebem winsorização (subset configurado).
    wins_cols = [c for c in numeric_features if c in config.WINSORIZE_FEATURES]
    steps = []
    if wins_cols:
        steps.append(
            ("winsorize", Winsorizer(percentile=config.WINSORIZE_PERCENTILE, columns=wins_cols))
        )
    steps.append(("impute", SimpleImputer(strategy="median")))
    steps.append(("scale", StandardScaler()))
    return Pipeline(steps)


def build_preprocessor(feature_list: list[str]) -> ColumnTransformer:
    """Constrói o ColumnTransformer para a lista de features do modelo.

    Separa as features em numéricas (winsorize+impute+scale) e binárias
    (passthrough), preservando uma ordem de saída determinística.
    """
    numeric = [
        f for f in feature_list
        if f in (config.NUMERIC_FEATURES + config.DERIVED_NUMERIC)
    ]
    binary = [
        f for f in feature_list
        if f in (config.BINARY_FEATURES + config.DERIVED_BINARY)
    ]

    ct = ColumnTransformer(
        transformers=[
            ("num", _numeric_pipeline(numeric), numeric),
            ("bin", "passthrough", binary),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    # Guarda a ordem de saída (num primeiro, depois bin) para casar com SHAP.
    ct._vitaliza_output_order = numeric + binary  # type: ignore[attr-defined]
    return ct


def get_output_feature_names(ct: ColumnTransformer) -> list[str]:
    """Ordem das colunas após o transform — fonte de verdade para SHAP/inferência."""
    return list(getattr(ct, "_vitaliza_output_order"))


if __name__ == "__main__":
    from .data_loader import load_data
    from .features import add_derived_features

    feats = config.model_feature_list()
    df = add_derived_features(load_data())
    pre = build_preprocessor(feats)
    Xt = pre.fit_transform(df[feats])
    print("shape transformado:", Xt.shape)
    print("ordem de saída:", get_output_feature_names(pre))
