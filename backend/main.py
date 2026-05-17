from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.pkl"

app = FastAPI(title="Gym Churn Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # em produção, troque pelo domínio da Vercel
    allow_methods=["*"],
    allow_headers=["*"],
)

FEATURES = [
    "Lifetime",
    "Avg_class_frequency_current_month",
    "Age",
    "Contract_period",
    "Month_to_end_contract",
    "Avg_class_frequency_total",
    "Avg_additional_charges_total",
    "Group_visits",
    "Promo_friends",
    "Partner",
    "Near_Location",
]

model = joblib.load(MODEL_PATH)

# Valores de referência usados quando o usuário informa só parte dos campos.
# Eles mantêm a predição possível, mas quanto menos dados reais, menor a confiança.
DEFAULT_FEATURE_VALUES = {
    "Lifetime": 4,
    "Avg_class_frequency_current_month": 2.0,
    "Age": 29,
    "Contract_period": 6,
    "Month_to_end_contract": 4.0,
    "Avg_class_frequency_total": 2.0,
    "Avg_additional_charges_total": 150.0,
    "Group_visits": 0,
    "Promo_friends": 0,
    "Partner": 0,
    "Near_Location": 1,
}

class CustomerData(BaseModel):
    Lifetime: int | None = None                              # meses como cliente
    Avg_class_frequency_current_month: float | None = None   # aulas/semana esse mês
    Age: int | None = None                                   # idade
    Contract_period: int | None = None                       # duração do contrato (meses)
    Month_to_end_contract: float | None = None               # meses até vencer o contrato
    Avg_class_frequency_total: float | None = None           # aulas/semana histórico
    Avg_additional_charges_total: float | None = None        # gastos extras (US$)
    Group_visits: int | None = None                          # faz aulas em grupo? (0 ou 1)
    Promo_friends: int | None = None                         # veio por indicação? (0 ou 1)
    Partner: int | None = None                               # empresa parceira? (0 ou 1)
    Near_Location: int | None = None                         # mora perto? (0 ou 1)

class PredictionResponse(BaseModel):
    churn_probability: float
    churn_label: str
    risk_level: str

@app.get("/")
def health_check():
    return {"status": "ok", "model": "gym-churn-v1"}

@app.post("/predict", response_model=PredictionResponse)
def predict(data: CustomerData):
    input_data = data.model_dump()
    informed_fields = sum(value is not None for value in input_data.values())

    if informed_fields < 2:
        raise HTTPException(
            status_code=400,
            detail="Informe pelo menos 2 campos para calcular o risco de churn.",
        )

    # Completa campos ausentes com valores de referência e mantém a ordem do treino.
    feature_values = [
        input_data[field]
        if input_data[field] is not None
        else DEFAULT_FEATURE_VALUES[field]
        for field in FEATURES
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
    )
