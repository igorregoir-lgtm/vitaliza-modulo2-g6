from __future__ import annotations

import pandas as pd
from fastapi import HTTPException

from .deck_builder import build_deck
from .documentation_builder import build_documentation
from .eda import compute_eda
from .models import (
    business_rules_baseline,
    kmeans_model,
    lightgbm_model,
    logistic_model,
    random_forest_model,
    xgboost_model,
)
from .persona_builder import build_personas
from .preprocessing import clean_churn_dataset

_MODEL_REGISTRY = {
    "kmeans": kmeans_model,
    "random_forest": random_forest_model,
    "logistic_regression": logistic_model,
    "xgboost": xgboost_model,
    "lightgbm": lightgbm_model,
    "business_rules_baseline": business_rules_baseline,
}

VALID_ALGORITHMS = list(_MODEL_REGISTRY.keys())


def run_analysis_pipeline(
    df: pd.DataFrame,
    algorithm: str,
    params: dict | None = None,
) -> dict:
    if algorithm not in _MODEL_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Algoritmo inválido. Opções: {', '.join(VALID_ALGORITHMS)}",
        )

    params = params or {}

    df_clean, cleaning = clean_churn_dataset(df)
    if len(df_clean) < 10:
        raise HTTPException(
            status_code=400,
            detail="CSV com poucos registros válidos após limpeza.",
        )

    eda_result = compute_eda(df_clean)
    eda_result["cleaning"] = cleaning

    module = _MODEL_REGISTRY[algorithm]
    model_result = module.run(df_clean, params)

    # Extract internal objects not safe for JSON serialisation
    trained_model = model_result.pop("_model", None)
    feature_defaults = model_result.pop("_feature_defaults", None)

    personas = build_personas(model_result.get("segments", []), algorithm)
    documentation = build_documentation(algorithm, model_result.get("metrics", {}))
    deck = build_deck(eda_result, model_result, personas, algorithm)

    return {
        "algorithm": algorithm,
        "model_type": model_result.get("model_type", "unknown"),
        "metrics": model_result.get("metrics", {}),
        "predictions": model_result.get("predictions", []),
        "segments": model_result.get("segments", []),
        "feature_importance": model_result.get("feature_importance", []),
        "heatmap": model_result.get("heatmap", []),
        "rules_used": model_result.get("rules_used", []),
        "eda": eda_result,
        "personas": personas,
        "documentation": documentation,
        "deck_sections": deck,
        "feature_defaults": feature_defaults,
        "_trained_model": trained_model,    # NOT JSON-safe; caller must pop
        "_feature_defaults": feature_defaults,
    }
