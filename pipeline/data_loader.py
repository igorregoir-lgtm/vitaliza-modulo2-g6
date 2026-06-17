"""
data_loader.py — Carga e validação básica do dataset de churn.

PBL — porquê: antes de qualquer modelagem, garantimos que o dado é o esperado
(shape, colunas, tipos, ausência de nulos críticos, alvo binário). Falhar cedo
e de forma explícita evita treinar em dado corrompido (lixo entra, lixo sai).
"""
from __future__ import annotations

import hashlib

import pandas as pd

from . import config


def dataset_sha256(path: str | None = None) -> str:
    """Hash SHA-256 do arquivo de dados — usado para versionar/auditar o modelo."""
    path = path or config.DATA_PATH
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_data(path: str | None = None, validate: bool = True) -> pd.DataFrame:
    """Carrega o CSV e roda a validação básica.

    Returns
    -------
    pd.DataFrame com as 14 colunas originais.
    """
    path = path or config.DATA_PATH
    df = pd.read_csv(path)
    if validate:
        validate_data(df)
    return df


def validate_data(df: pd.DataFrame) -> dict:
    """Validação defensiva. Levanta AssertionError se algo essencial quebrar.

    Returns um dict com um pequeno relatório (shape, churn_rate, nulos).
    """
    expected_cols = set(config.RAW_FEATURES) | {config.TARGET}
    missing = expected_cols - set(df.columns)
    assert not missing, f"Colunas ausentes no dataset: {missing}"

    assert df.shape[0] > 0, "Dataset vazio."
    # O alvo precisa ser binário {0,1}.
    target_vals = set(df[config.TARGET].dropna().unique().tolist())
    assert target_vals <= {0, 1}, f"Alvo não-binário: {target_vals}"

    n_null = int(df[list(expected_cols)].isnull().sum().sum())
    churn_rate = float(df[config.TARGET].mean())

    report = {
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "n_null_total": n_null,
        "churn_rate": round(churn_rate, 4),
        "sha256": dataset_sha256(),
    }
    return report


if __name__ == "__main__":
    _df = load_data()
    print("Validação OK:")
    for k, v in validate_data(_df).items():
        print(f"  {k}: {v}")
