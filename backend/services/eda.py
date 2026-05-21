import pandas as pd

from .preprocessing import FEATURES, build_derived_features


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


def compute_correlations(df: pd.DataFrame) -> list[dict]:
    df_eda = build_derived_features(df)
    derived = ["ratio_freq_atual_vs_lifetime", "flag_early_user", "flag_sleeping_dog"]
    numeric_cols = FEATURES + derived + ["Churn"]

    correlations = (
        df_eda[numeric_cols]
        .corr(numeric_only=True)["Churn"]
        .drop("Churn")
        .sort_values(key=lambda v: v.abs(), ascending=False)
    )
    return [
        {
            "feature": feat,
            "correlation": round(float(val), 4),
            "strength": round(float(abs(val)), 4),
        }
        for feat, val in correlations.head(8).items()
    ]


def compute_churn_comparison(df: pd.DataFrame) -> list[dict]:
    churn_means = df.groupby("Churn")[
        [
            "Age",
            "Lifetime",
            "Avg_class_frequency_current_month",
            "Avg_class_frequency_total",
            "Avg_additional_charges_total",
        ]
    ].mean()

    labels = {
        "Age": "Idade média",
        "Lifetime": "Tempo médio como cliente",
        "Avg_class_frequency_current_month": "Freq. média no mês",
        "Avg_class_frequency_total": "Freq. média histórica",
        "Avg_additional_charges_total": "Gastos extras médios",
    }
    return [
        {
            "label": label,
            "stayed": (
                round(float(churn_means.loc[0, feat]), 2)
                if 0 in churn_means.index
                else None
            ),
            "churned": (
                round(float(churn_means.loc[1, feat]), 2)
                if 1 in churn_means.index
                else None
            ),
        }
        for feat, label in labels.items()
    ]


def build_survival_curve(df: pd.DataFrame) -> list[dict]:
    survival_probability = 1.0
    curve = []
    for lifetime in sorted(df["Lifetime"].unique()):
        at_risk = df[df["Lifetime"] >= lifetime]
        events = df[(df["Lifetime"] == lifetime) & (df["Churn"] == 1)]
        hazard = len(events) / len(at_risk) if len(at_risk) else 0
        survival_probability *= 1 - hazard
        curve.append(
            {
                "lifetime": int(lifetime),
                "survival_probability": round(float(survival_probability), 4),
                "at_risk": int(len(at_risk)),
                "events": int(len(events)),
            }
        )
    return curve


def build_cohort_churn(df: pd.DataFrame) -> list[dict]:
    bins = [-1, 1, 3, 6, 12, float("inf")]
    labels = ["0-1 mês", "2-3 meses", "4-6 meses", "7-12 meses", "13+ meses"]
    df = df.copy()
    df["cohort"] = pd.cut(df["Lifetime"], bins=bins, labels=labels, include_lowest=True)
    grouped = df.groupby("cohort", observed=False)["Churn"].agg(["mean", "count"])
    return [
        {
            "label": str(label),
            "churn_rate": round(float(row["mean"]), 4) if pd.notna(row["mean"]) else 0,
            "count": int(row["count"]),
        }
        for label, row in grouped.iterrows()
    ]


def build_diagnostic_segments(df: pd.DataFrame) -> list[dict]:
    df_eda = build_derived_features(df)
    total_churn = max(int((df_eda["Churn"] == 1).sum()), 1)
    total_base = max(int(len(df_eda)), 1)

    early_droppers = df_eda[(df_eda["Lifetime"] <= 1) & (df_eda["Churn"] == 1)]
    sleeping_dogs = df_eda[
        (df_eda["Lifetime"] > 6) & (df_eda["Avg_class_frequency_current_month"] < 0.5)
    ]
    annual_zero = df_eda[
        (df_eda["Contract_period"] == 12)
        & (df_eda["Avg_class_frequency_current_month"] == 0)
    ]

    pipeline_est = int(len(annual_zero) * 150 * 12)
    return [
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
            "count": int(len(annual_zero)),
            "percentage": round(float(len(annual_zero) / total_base), 4),
            "reference": "% da base total",
            "action": "Monitorar vencimento e criar oferta de retomada.",
            "estimated_pipeline": pipeline_est,
        },
    ]


def build_frequency_scatter(df: pd.DataFrame) -> list[dict]:
    df_eda = build_derived_features(df)
    sample = df_eda.sample(n=min(len(df_eda), 300), random_state=42)
    return [
        {
            "x": round(float(row["Avg_class_frequency_total"]), 3),
            "y": round(float(row["Avg_class_frequency_current_month"]), 3),
            "churn": int(row["Churn"]),
            "sleeping_dog": int(row["flag_sleeping_dog"]),
        }
        for _, row in sample.iterrows()
    ]


def compute_eda(df: pd.DataFrame) -> dict:
    return {
        "summary": {
            "customers": int(len(df)),
            "churn_rate": round(float(df["Churn"].mean()), 4),
            "avg_age": round(float(df["Age"].mean()), 1),
            "avg_lifetime": round(float(df["Lifetime"].mean()), 1),
            "avg_frequency_month": round(
                float(df["Avg_class_frequency_current_month"].mean()), 2
            ),
            "avg_extra_charges": round(
                float(df["Avg_additional_charges_total"].mean()), 2
            ),
        },
        "distributions": {
            "churn": value_distribution(df, "Churn"),
            "contract_period": value_distribution(df, "Contract_period"),
            "group_visits": value_distribution(df, "Group_visits"),
        },
        "top_correlations": compute_correlations(df),
        "comparison_by_churn": compute_churn_comparison(df),
        "frequency_scatter": build_frequency_scatter(df),
        "survival_curve": build_survival_curve(df),
        "cohort_churn": build_cohort_churn(df),
        "diagnostic_segments": build_diagnostic_segments(df),
    }
