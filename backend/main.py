from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.data_loader import read_uploaded_csv
from services.eda import compute_eda
from services.pipeline import VALID_ALGORITHMS, run_analysis_pipeline
from services.preprocessing import (
    BINARY_FEATURES,
    DEFAULT_FEATURE_VALUES,
    FEATURE_LABELS,
    FEATURES,
    clean_churn_dataset,
    compute_feature_defaults,
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.pkl"

app = FastAPI(title="Vitaliza — Churn Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Runtime state (persists while the process is alive)
# ---------------------------------------------------------------------------
model = None
feature_defaults: dict = DEFAULT_FEATURE_VALUES.copy()
model_feature_importances: dict = {}
last_training_info: dict | None = None


def _load_model():
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)


def _extract_importances(current_model) -> dict:
    if current_model is None:
        return {}
    clf = current_model
    if hasattr(current_model, "named_steps"):
        clf = current_model.named_steps.get("clf", current_model)
    if hasattr(clf, "feature_importances_"):
        return {feat: float(imp) for feat, imp in zip(FEATURES, clf.feature_importances_)}
    if hasattr(clf, "coef_"):
        return {feat: float(abs(c)) for feat, c in zip(FEATURES, clf.coef_[0])}
    return {}


model = _load_model()
model_feature_importances = _extract_importances(model)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class CustomerData(BaseModel):
    Lifetime: int | None = None
    Avg_class_frequency_current_month: float | None = None
    Age: int | None = None
    Contract_period: int | None = None
    Month_to_end_contract: float | None = None
    Avg_class_frequency_total: float | None = None
    Avg_additional_charges_total: float | None = None
    Group_visits: int | None = None
    Promo_friends: int | None = None
    Partner: int | None = None
    Near_Location: int | None = None


class PredictionResponse(BaseModel):
    churn_probability: float
    churn_label: str
    risk_level: str
    top_3_drivers: list[dict]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {
        "status": "ok",
        "model": "vitaliza-churn-v2",
        "model_loaded": model is not None,
        "trained_at": last_training_info["trained_at"] if last_training_info else None,
        "metrics": last_training_info["metrics"] if last_training_info else None,
        "valid_algorithms": VALID_ALGORITHMS,
    }


_TRAINABLE_ALGORITHMS = {
    "random_forest",
    "logistic_regression",
    "xgboost",
    "lightgbm",
}


@app.post("/train")
async def train_from_csv(
    file: UploadFile = File(...),
    algorithm: str = Form("random_forest"),
):
    global model, feature_defaults, model_feature_importances, last_training_info

    if algorithm not in _TRAINABLE_ALGORITHMS:
        raise HTTPException(
            status_code=400,
            detail=f"Algoritmo inválido para treino. Opções: {', '.join(sorted(_TRAINABLE_ALGORITHMS))}",
        )

    uploaded_df = await read_uploaded_csv(file)
    df, _ = clean_churn_dataset(uploaded_df)

    if len(df) < 10:
        raise HTTPException(
            status_code=400,
            detail="CSV com poucos registros válidos para treino após limpeza.",
        )
    if df["Churn"].nunique() < 2 or df["Churn"].value_counts().min() < 2:
        raise HTTPException(
            status_code=400,
            detail="A coluna Churn precisa ter exemplos suficientes das classes 0 e 1.",
        )

    from services.models import (
        lightgbm_model,
        logistic_model,
        random_forest_model,
        xgboost_model,
    )

    _modules = {
        "random_forest": random_forest_model,
        "logistic_regression": logistic_model,
        "xgboost": xgboost_model,
        "lightgbm": lightgbm_model,
    }

    result = _modules[algorithm].run(df, {})
    trained_model = result.pop("_model", None)
    feature_defs = result.pop("_feature_defaults", None)

    if trained_model is not None:
        model = trained_model
        feature_defaults = feature_defs or compute_feature_defaults(df)
        model_feature_importances = _extract_importances(model)
        joblib.dump(model, MODEL_PATH)

    metrics = result["metrics"]
    last_training_info = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "filename": file.filename,
        "algorithm": algorithm,
        "metrics": metrics,
    }

    return {
        "status": "trained",
        "model_loaded": True,
        "trained_at": last_training_info["trained_at"],
        "filename": file.filename,
        "algorithm": algorithm,
        "metrics": metrics,
    }


@app.post("/eda")
async def analyze_uploaded_csv(file: UploadFile = File(...)):
    uploaded_df = await read_uploaded_csv(file)
    df, cleaning = clean_churn_dataset(uploaded_df)

    if len(df) < 2:
        raise HTTPException(
            status_code=400,
            detail="CSV com poucos registros válidos para análise após limpeza.",
        )

    result = compute_eda(df)
    result["status"] = "analyzed"
    result["filename"] = file.filename
    result["cleaning"] = cleaning
    return result


@app.post("/analyze")
async def analyze_with_algorithm(
    file: UploadFile = File(...),
    algorithm: str = Form("random_forest"),
    n_clusters: int = Form(4),
):
    if algorithm not in VALID_ALGORITHMS:
        raise HTTPException(
            status_code=400,
            detail=f"Algoritmo inválido: {algorithm}. Opções: {', '.join(VALID_ALGORITHMS)}",
        )

    uploaded_df = await read_uploaded_csv(file)
    params = {"n_clusters": n_clusters}
    result = run_analysis_pipeline(uploaded_df, algorithm, params)
    result["status"] = "analyzed"
    result["filename"] = file.filename
    return result


@app.post("/predict", response_model=PredictionResponse)
def predict(data: CustomerData):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Modelo não treinado. Faça upload do CSV na aba Upload CSV.",
        )

    input_data = data.model_dump()
    informed_fields = sum(v is not None for v in input_data.values())

    if informed_fields < 2:
        raise HTTPException(
            status_code=400,
            detail="Informe pelo menos 2 campos para calcular o risco de churn.",
        )

    feature_values = [
        input_data[f] if input_data[f] is not None else feature_defaults[f]
        for f in FEATURES
    ]
    features = pd.DataFrame([feature_values], columns=FEATURES)
    prob = model.predict_proba(features)[0][1]

    if prob >= 0.7:
        label, level = "Alto Risco de Churn", "high"
    elif prob >= 0.4:
        label, level = "Risco Médio de Churn", "medium"
    else:
        label, level = "Baixo Risco de Churn", "low"

    return PredictionResponse(
        churn_probability=round(float(prob), 4),
        churn_label=label,
        risk_level=level,
        top_3_drivers=_calculate_top_3_drivers(features),
    )


def _calculate_top_3_drivers(features: pd.DataFrame) -> list[dict]:
    drivers = []
    for feat in FEATURES:
        value = float(features.loc[0, feat])
        ref = float(feature_defaults.get(feat, DEFAULT_FEATURE_VALUES[feat]))
        importance = float(model_feature_importances.get(feat, 0))
        normalized_delta = abs(value - ref) / max(abs(ref), 1)
        driver_score = importance * max(normalized_delta, 0.2)

        drivers.append(
            {
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "value": round(value, 4),
                "reference_value": round(ref, 4),
                "importance": round(importance, 4),
                "driver_score": round(driver_score, 4),
                "direction": (
                    "acima da referência"
                    if value > ref
                    else "abaixo da referência" if value < ref else "na referência"
                ),
            }
        )

    return sorted(
        drivers,
        key=lambda x: (x["driver_score"], x["importance"]),
        reverse=True,
    )[:3]
