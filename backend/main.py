from datetime import datetime, timezone
from io import BytesIO
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    roc_auc_score,
    silhouette_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent

CLUSTER_NAMES = {
    0: "C0 · Recém-chegado em fuga",
    1: "C1 · Leal anual",
    2: "C2 · Engajado mensal",
    3: "C3 · Médio em trânsito",
}

HEATMAP_FEATURES = [
    "Lifetime",
    "Avg_class_frequency_current_month",
    "Age",
    "Contract_period",
    "Month_to_end_contract",
    "Avg_class_frequency_total",
    "Group_visits",
    "Promo_friends",
    "Partner",
]

HEATMAP_LABELS = {
    "Lifetime": "Tempo como cliente",
    "Avg_class_frequency_current_month": "Frequência atual",
    "Age": "Idade",
    "Contract_period": "Duração contrato",
    "Month_to_end_contract": "Meses até vencer",
    "Avg_class_frequency_total": "Frequência histórica",
    "Group_visits": "Desafios em grupo",
    "Promo_friends": "Indicação de amigos",
    "Partner": "Convênio empresarial",
}
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

BINARY_FEATURES = ["Group_visits", "Promo_friends", "Partner", "Near_Location"]

FEATURE_LABELS = {
    "Lifetime": "Tempo como cliente",
    "Avg_class_frequency_current_month": "Frequência atual",
    "Age": "Idade",
    "Contract_period": "Duração do contrato",
    "Month_to_end_contract": "Meses até vencer",
    "Avg_class_frequency_total": "Frequência histórica",
    "Avg_additional_charges_total": "Gastos extras",
    "Group_visits": "Aulas em grupo",
    "Promo_friends": "Indicação de amigos",
    "Partner": "Empresa parceira",
    "Near_Location": "Mora perto",
}


async def read_uploaded_csv(file: UploadFile) -> pd.DataFrame:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo CSV válido.")

    try:
        contents = await file.read()
        return pd.read_csv(BytesIO(contents))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Não foi possível ler o CSV: {exc}",
        ) from exc


def validate_required_columns(df: pd.DataFrame) -> None:
    required_columns = FEATURES + ["Churn"]
    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"CSV sem colunas obrigatórias: {', '.join(missing_columns)}",
        )


def clean_churn_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    validate_required_columns(df)

    rows_original = int(len(df))
    null_values = int(df[FEATURES + ["Churn"]].isna().sum().sum())
    duplicated_rows = int(df.duplicated().sum())

    # Mantém somente a superfície usada na Semana 5 e remove registros inválidos.
    clean_df = df[FEATURES + ["Churn"]].drop_duplicates().dropna()

    return clean_df, {
        "rows_original": rows_original,
        "rows_clean": int(len(clean_df)),
        "duplicates_removed": duplicated_rows,
        "null_values": null_values,
    }


def value_distribution(df: pd.DataFrame, column: str) -> list[dict]:
    total = len(df)
    counts = df[column].value_counts().sort_index()
    return [
        {
            "label": str(label),
            "count": int(count),
            "percentage": round(float(count / total), 4),
        }
        for label, count in counts.items()
    ]


def build_week5_eda_extensions(df: pd.DataFrame) -> dict:
    df_eda = df.copy()
    df_eda["ratio_freq_atual_vs_lifetime"] = (
        df_eda["Avg_class_frequency_current_month"]
        / df_eda["Avg_class_frequency_total"].replace(0, pd.NA)
    ).fillna(0)
    df_eda["flag_early_user"] = (df_eda["Lifetime"] <= 1).astype(int)
    df_eda["flag_sleeping_dog"] = (
        (df_eda["Lifetime"] > 6)
        & (df_eda["Avg_class_frequency_current_month"] < 0.5)
    ).astype(int)

    scatter_sample = df_eda.sample(
        n=min(len(df_eda), 300),
        random_state=42,
    )
    frequency_scatter = [
        {
            "x": round(float(row["Avg_class_frequency_total"]), 3),
            "y": round(float(row["Avg_class_frequency_current_month"]), 3),
            "churn": int(row["Churn"]),
            "sleeping_dog": int(row["flag_sleeping_dog"]),
        }
        for _, row in scatter_sample.iterrows()
    ]

    survival_probability = 1.0
    survival_curve = []
    for lifetime in sorted(df_eda["Lifetime"].unique()):
        at_risk = df_eda[df_eda["Lifetime"] >= lifetime]
        events = df_eda[
            (df_eda["Lifetime"] == lifetime)
            & (df_eda["Churn"] == 1)
        ]
        hazard = len(events) / len(at_risk) if len(at_risk) else 0
        survival_probability *= 1 - hazard
        survival_curve.append({
            "lifetime": int(lifetime),
            "survival_probability": round(float(survival_probability), 4),
            "at_risk": int(len(at_risk)),
            "events": int(len(events)),
        })

    cohort_bins = [-1, 1, 3, 6, 12, float("inf")]
    cohort_labels = ["0-1 mês", "2-3 meses", "4-6 meses", "7-12 meses", "13+ meses"]
    df_eda["cohort_lifetime"] = pd.cut(
        df_eda["Lifetime"],
        bins=cohort_bins,
        labels=cohort_labels,
        include_lowest=True,
    )
    cohort_group = df_eda.groupby("cohort_lifetime", observed=False)["Churn"].agg(["mean", "count"])
    cohort_churn = [
        {
            "label": str(label),
            "churn_rate": round(float(row["mean"]), 4) if pd.notna(row["mean"]) else 0,
            "count": int(row["count"]),
        }
        for label, row in cohort_group.iterrows()
    ]

    early_droppers = df_eda[(df_eda["Lifetime"] <= 1) & (df_eda["Churn"] == 1)]
    sleeping_dogs = df_eda[
        (df_eda["Lifetime"] > 6)
        & (df_eda["Avg_class_frequency_current_month"] < 0.5)
    ]
    annual_zero_usage = df_eda[
        (df_eda["Contract_period"] == 12)
        & (df_eda["Avg_class_frequency_current_month"] == 0)
    ]

    total_churn = max(int((df_eda["Churn"] == 1).sum()), 1)
    total_base = max(int(len(df_eda)), 1)
    estimated_monthly_ticket = 150
    deferred_churn_pipeline = int(len(annual_zero_usage) * estimated_monthly_ticket * 12)

    diagnostic_segments = [
        {
            "key": "early_droppers",
            "label": "Early droppers",
            "count": int(len(early_droppers)),
            "percentage": round(float(len(early_droppers) / total_churn), 4),
            "reference": "% do churn total",
            "action": "Onboarding intensivo nos primeiros 30 dias.",
        },
        {
            "key": "sleeping_dogs",
            "label": "Sleeping dogs",
            "count": int(len(sleeping_dogs)),
            "percentage": round(float(len(sleeping_dogs) / total_base), 4),
            "reference": "% da base total",
            "action": "Reativação cuidadosa para evitar contato excessivo.",
        },
        {
            "key": "annual_zero_usage",
            "label": "Anuais com uso zero",
            "count": int(len(annual_zero_usage)),
            "percentage": round(float(len(annual_zero_usage) / total_base), 4),
            "reference": "% da base total",
            "action": "Monitorar vencimento e criar oferta de retomada.",
            "estimated_pipeline": deferred_churn_pipeline,
        },
    ]

    return {
        "frequency_scatter": frequency_scatter,
        "survival_curve": survival_curve,
        "cohort_churn": cohort_churn,
        "diagnostic_segments": diagnostic_segments,
    }

def load_model():
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)


def extract_feature_importances(current_model) -> dict[str, float]:
    if current_model is None or not hasattr(current_model, "feature_importances_"):
        return {}

    return {
        feature: float(importance)
        for feature, importance in zip(FEATURES, current_model.feature_importances_)
    }

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

model = load_model()
feature_defaults = DEFAULT_FEATURE_VALUES.copy()
model_feature_importances = extract_feature_importances(model)
last_training_info = None

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
    top_3_drivers: list[dict]

@app.get("/")
def health_check():
    return {
        "status": "ok",
        "model": "gym-churn-v1",
        "model_loaded": model is not None,
        "trained_at": last_training_info["trained_at"] if last_training_info else None,
        "metrics": last_training_info["metrics"] if last_training_info else None,
    }

@app.post("/train")
async def train_from_csv(file: UploadFile = File(...)):
    global model, feature_defaults, model_feature_importances, last_training_info

    uploaded_df = await read_uploaded_csv(file)
    df, _ = clean_churn_dataset(uploaded_df)
    if len(df) < 10:
        raise HTTPException(
            status_code=400,
            detail="CSV com poucos registros válidos para treino após limpeza.",
        )

    X = df[FEATURES]
    y = df["Churn"]

    if y.nunique() < 2 or y.value_counts().min() < 2:
        raise HTTPException(
            status_code=400,
            detail="A coluna Churn precisa ter exemplos suficientes das classes 0 e 1.",
        )

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    trained_model = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        n_jobs=-1,
    )
    trained_model.fit(X_train, y_train)

    y_pred = trained_model.predict(X_test)
    y_proba = trained_model.predict_proba(X_test)[:, 1]

    metrics = {
        "rows_used": int(len(df)),
        "test_rows": int(len(X_test)),
        "churn_rate": round(float(y.mean()), 4),
        "roc_auc": round(float(roc_auc_score(y_test, y_proba)), 4),
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
    }

    # Atualiza os valores de referência usados quando a inferência recebe campos parciais.
    feature_defaults = {
        feature: float(X[feature].median())
        for feature in FEATURES
    }
    for binary_feature in ["Group_visits", "Promo_friends", "Partner", "Near_Location"]:
        feature_defaults[binary_feature] = int(X[binary_feature].mode().iloc[0])

    model = trained_model
    model_feature_importances = extract_feature_importances(model)
    joblib.dump(model, MODEL_PATH)
    last_training_info = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "filename": file.filename,
        "metrics": metrics,
    }

    return {
        "status": "trained",
        "model_loaded": True,
        "trained_at": last_training_info["trained_at"],
        "filename": file.filename,
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

    df = df.copy()
    df["ratio_freq_atual_vs_lifetime"] = (
        df["Avg_class_frequency_current_month"]
        / df["Avg_class_frequency_total"].replace(0, pd.NA)
    ).fillna(0)
    df["flag_early_user"] = (df["Lifetime"] <= 1).astype(int)
    df["flag_sleeping_dog"] = (
        (df["Lifetime"] > 6)
        & (df["Avg_class_frequency_current_month"] < 0.5)
    ).astype(int)

    derived_features = [
        "ratio_freq_atual_vs_lifetime",
        "flag_early_user",
        "flag_sleeping_dog",
    ]
    numeric_features = FEATURES + derived_features + ["Churn"]
    correlations = (
        df[numeric_features]
        .corr(numeric_only=True)["Churn"]
        .drop("Churn")
        .sort_values(key=lambda values: values.abs(), ascending=False)
    )

    top_correlations = [
        {
            "feature": feature,
            "correlation": round(float(value), 4),
            "strength": round(float(abs(value)), 4),
        }
        for feature, value in correlations.head(8).items()
    ]

    churn_means = df.groupby("Churn")[[
        "Age",
        "Lifetime",
        "Avg_class_frequency_current_month",
        "Avg_class_frequency_total",
        "Avg_additional_charges_total",
    ]].mean()

    comparison = []
    comparison_labels = {
        "Age": "Idade média",
        "Lifetime": "Tempo médio como cliente",
        "Avg_class_frequency_current_month": "Freq. média no mês",
        "Avg_class_frequency_total": "Freq. média histórica",
        "Avg_additional_charges_total": "Gastos extras médios",
    }
    for feature, label in comparison_labels.items():
        comparison.append({
            "label": label,
            "stayed": round(float(churn_means.loc[0, feature]), 2) if 0 in churn_means.index else None,
            "churned": round(float(churn_means.loc[1, feature]), 2) if 1 in churn_means.index else None,
        })

    week5_extensions = build_week5_eda_extensions(df)

    return {
        "status": "analyzed",
        "filename": file.filename,
        "cleaning": cleaning,
        "summary": {
            "customers": int(len(df)),
            "churn_rate": round(float(df["Churn"].mean()), 4),
            "avg_age": round(float(df["Age"].mean()), 1),
            "avg_lifetime": round(float(df["Lifetime"].mean()), 1),
            "avg_frequency_month": round(float(df["Avg_class_frequency_current_month"].mean()), 2),
            "avg_extra_charges": round(float(df["Avg_additional_charges_total"].mean()), 2),
        },
        "distributions": {
            "churn": value_distribution(df, "Churn"),
            "contract_period": value_distribution(df, "Contract_period"),
            "group_visits": value_distribution(df, "Group_visits"),
        },
        "top_correlations": top_correlations,
        "comparison_by_churn": comparison,
        "frequency_scatter": week5_extensions["frequency_scatter"],
        "survival_curve": week5_extensions["survival_curve"],
        "cohort_churn": week5_extensions["cohort_churn"],
        "diagnostic_segments": week5_extensions["diagnostic_segments"],
    }


@app.post("/segment")
async def segment_dataset(file: UploadFile = File(...)):
    uploaded_df = await read_uploaded_csv(file)
    df, _ = clean_churn_dataset(uploaded_df)

    if len(df) < 20:
        raise HTTPException(
            status_code=400,
            detail="CSV com poucos registros válidos para segmentação após limpeza.",
        )

    X = df[FEATURES].copy()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=4, random_state=42, n_init=30)
    labels = kmeans.fit_predict(X_scaled)

    df = df.copy()
    df["Cluster"] = labels

    sil = float(silhouette_score(X_scaled, labels))
    inertia = float(kmeans.inertia_)

    cluster_stats = []
    cluster_means: dict[str, dict] = {}
    for cid in range(4):
        mask = df["Cluster"] == cid
        cdf = df[mask]
        churn_rate = float(cdf["Churn"].mean()) if len(cdf) > 0 else 0.0
        cluster_stats.append({
            "id": cid,
            "name": CLUSTER_NAMES[cid],
            "count": int(len(cdf)),
            "percentage": round(float(len(cdf) / len(df)), 4),
            "churn_rate": round(churn_rate, 4),
        })
        means = {}
        for feat in HEATMAP_FEATURES:
            if feat in cdf.columns:
                means[feat] = round(float(cdf[feat].mean()), 3)
        cluster_means[str(cid)] = means

    # Normalise values to 0-1 for heatmap colouring
    heatmap_normalized: dict[str, list] = {}
    for feat in HEATMAP_FEATURES:
        vals = [cluster_means[str(c)].get(feat, 0.0) for c in range(4)]
        min_v, max_v = min(vals), max(vals)
        span = max_v - min_v if max_v != min_v else 1.0
        heatmap_normalized[feat] = [round((v - min_v) / span, 3) for v in vals]

    # RF churn probability per cluster (only when model is trained)
    rf_by_cluster = []
    if model is not None:
        for cid in range(4):
            mask = df["Cluster"] == cid
            cdf = df[mask]
            if len(cdf) > 0:
                proba = model.predict_proba(cdf[FEATURES])[:, 1]
                n = len(proba)
                rf_by_cluster.append({
                    "cluster_id": cid,
                    "name": CLUSTER_NAMES[cid],
                    "avg_churn_prob": round(float(proba.mean()), 4),
                    "high_risk_pct": round(float((proba >= 0.7).sum() / n), 4),
                    "med_risk_pct": round(
                        float(((proba >= 0.4) & (proba < 0.7)).sum() / n), 4
                    ),
                    "low_risk_pct": round(float((proba < 0.4).sum() / n), 4),
                })

    return {
        "status": "segmented",
        "n_clusters": 4,
        "inertia": round(inertia, 2),
        "silhouette_score": round(sil, 4),
        "cluster_stats": cluster_stats,
        "cluster_means": cluster_means,
        "heatmap_features": HEATMAP_FEATURES,
        "heatmap_labels": HEATMAP_LABELS,
        "heatmap_normalized": heatmap_normalized,
        "rf_by_cluster": rf_by_cluster,
    }


def calculate_top_3_drivers(features: pd.DataFrame) -> list[dict]:
    drivers = []

    for feature in FEATURES:
        value = float(features.loc[0, feature])
        reference_value = float(feature_defaults.get(feature, DEFAULT_FEATURE_VALUES[feature]))
        importance = float(model_feature_importances.get(feature, 0))
        normalized_delta = abs(value - reference_value) / max(abs(reference_value), 1)
        driver_score = importance * max(normalized_delta, 0.2)

        if value > reference_value:
            direction = "acima da referência"
        elif value < reference_value:
            direction = "abaixo da referência"
        else:
            direction = "na referência"

        drivers.append({
            "feature": feature,
            "label": FEATURE_LABELS.get(feature, feature),
            "value": round(value, 4),
            "reference_value": round(reference_value, 4),
            "importance": round(importance, 4),
            "driver_score": round(driver_score, 4),
            "direction": direction,
        })

    return sorted(
        drivers,
        key=lambda item: (item["driver_score"], item["importance"]),
        reverse=True,
    )[:3]


@app.post("/predict", response_model=PredictionResponse)
def predict(data: CustomerData):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Modelo não treinado. Faça upload do CSV na aba Upload CSV.",
        )

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
        else feature_defaults[field]
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
        top_3_drivers=calculate_top_3_drivers(features),
    )
