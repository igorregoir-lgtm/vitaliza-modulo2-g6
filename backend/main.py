from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI(title="Gym Churn Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # em produção, troque pelo domínio da Vercel
    allow_methods=["*"],
    allow_headers=["*"],
)

model = joblib.load("model.pkl")

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

class CustomerData(BaseModel):
    Lifetime: int                              # meses como cliente
    Avg_class_frequency_current_month: float   # aulas/semana esse mês
    Age: int                                   # idade
    Contract_period: int                       # duração do contrato (meses)
    Month_to_end_contract: float               # meses até vencer o contrato
    Avg_class_frequency_total: float           # aulas/semana histórico
    Avg_additional_charges_total: float        # gastos extras (R$)
    Group_visits: int                          # faz aulas em grupo? (0 ou 1)
    Promo_friends: int                         # veio por indicação? (0 ou 1)
    Partner: int                               # empresa parceira? (0 ou 1)
    Near_Location: int                         # mora perto? (0 ou 1)

class PredictionResponse(BaseModel):
    churn_probability: float
    churn_label: str
    risk_level: str

@app.get("/")
def health_check():
    return {"status": "ok", "model": "gym-churn-v1"}

@app.post("/predict", response_model=PredictionResponse)
def predict(data: CustomerData):
    features = np.array([[
        data.Lifetime,
        data.Avg_class_frequency_current_month,
        data.Age,
        data.Contract_period,
        data.Month_to_end_contract,
        data.Avg_class_frequency_total,
        data.Avg_additional_charges_total,
        data.Group_visits,
        data.Promo_friends,
        data.Partner,
        data.Near_Location,
    ]])

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
