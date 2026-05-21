import pandas as pd


def _classify_risk(row: dict) -> str:
    score = 0

    contract = row.get("Contract_period", 6)
    if contract == 1:
        score += 3
    elif contract == 6:
        score += 1

    lifetime = row.get("Lifetime", 4)
    if lifetime <= 1:
        score += 3
    elif lifetime <= 3:
        score += 2
    elif lifetime <= 6:
        score += 1

    freq_current = row.get("Avg_class_frequency_current_month", 2.0)
    freq_total = row.get("Avg_class_frequency_total", 2.0)
    if freq_current == 0:
        score += 2
    elif freq_total > 0 and freq_current / freq_total < 0.5:
        score += 2

    months_end = row.get("Month_to_end_contract", 4.0)
    if months_end <= 1:
        score += 1

    if row.get("Group_visits", 0) == 1:
        score -= 1
    if row.get("Promo_friends", 0) == 1:
        score -= 1
    if row.get("Partner", 0) == 1:
        score -= 1
    if row.get("Near_Location", 1) == 1:
        score -= 1

    if score >= 5:
        return "Alto Risco"
    elif score >= 3:
        return "Risco Médio"
    return "Baixo Risco"


def run(df: pd.DataFrame, params: dict) -> dict:
    df = df.copy()
    df["_risk_label"] = df.apply(lambda row: _classify_risk(row.to_dict()), axis=1)

    segments = []
    for level in ["Alto Risco", "Risco Médio", "Baixo Risco"]:
        subset = df[df["_risk_label"] == level]
        segments.append(
            {
                "label": level,
                "count": int(len(subset)),
                "churn_rate": (
                    round(float(subset["Churn"].mean()), 4)
                    if "Churn" in df.columns and len(subset) > 0
                    else None
                ),
            }
        )

    rules_used = [
        "Contrato mensal (1 mês) → risco alto",
        "Contrato semestral (6 meses) → risco moderado",
        "Lifetime ≤ 1 mês → risco alto (early dropper)",
        "Lifetime 2-3 meses → risco elevado",
        "Frequência atual = 0 → risco elevado (sleeping dog)",
        "Frequência atual < 50% do histórico → risco elevado",
        "Contrato próximo do fim (≤ 1 mês) → risco adicional",
        "Aulas em grupo → fator protetivo",
        "Indicação de amigos → fator protetivo",
        "Empresa parceira → fator protetivo",
        "Mora perto da academia → fator protetivo",
    ]

    return {
        "model_type": "baseline",
        "metrics": {
            "rows_used": int(len(df)),
            "churn_rate": (
                round(float(df["Churn"].mean()), 4) if "Churn" in df.columns else None
            ),
            "rules_count": len(rules_used),
        },
        "segments": segments,
        "heatmap": [],
        "feature_importance": [
            {"feature": "Contract_period", "label": "Duração do contrato", "importance": 0.30},
            {"feature": "Lifetime", "label": "Tempo como cliente", "importance": 0.28},
            {
                "feature": "Avg_class_frequency_current_month",
                "label": "Frequência atual",
                "importance": 0.22,
            },
            {
                "feature": "Month_to_end_contract",
                "label": "Meses até vencer",
                "importance": 0.12,
            },
            {"feature": "Group_visits", "label": "Aulas em grupo", "importance": 0.08},
        ],
        "predictions": [
            {"index": int(i), "risk_label": row["_risk_label"]}
            for i, row in enumerate(df.head(500).to_dict("records"))
        ],
        "rules_used": rules_used,
    }
