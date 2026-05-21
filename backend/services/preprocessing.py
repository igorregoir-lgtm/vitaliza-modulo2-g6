import pandas as pd
from fastapi import HTTPException

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


def validate_required_columns(df: pd.DataFrame, require_churn: bool = True) -> None:
    required = FEATURES + (["Churn"] if require_churn else [])
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV sem colunas obrigatórias: {', '.join(missing)}",
        )


def clean_churn_dataset(
    df: pd.DataFrame, require_churn: bool = True
) -> tuple[pd.DataFrame, dict]:
    validate_required_columns(df, require_churn=require_churn)

    cols = FEATURES + (["Churn"] if require_churn else [])
    rows_original = int(len(df))
    null_values = int(df[cols].isna().sum().sum())
    duplicated_rows = int(df.duplicated().sum())

    clean_df = df[cols].drop_duplicates().dropna()

    return clean_df, {
        "rows_original": rows_original,
        "rows_clean": int(len(clean_df)),
        "duplicates_removed": duplicated_rows,
        "null_values": null_values,
    }


def build_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["ratio_freq_atual_vs_lifetime"] = (
        df["Avg_class_frequency_current_month"]
        / df["Avg_class_frequency_total"].replace(0, pd.NA)
    ).fillna(0)
    df["flag_early_user"] = (df["Lifetime"] <= 1).astype(int)
    df["flag_sleeping_dog"] = (
        (df["Lifetime"] > 6) & (df["Avg_class_frequency_current_month"] < 0.5)
    ).astype(int)
    return df


def compute_feature_defaults(df: pd.DataFrame) -> dict:
    defaults = {feat: float(df[feat].median()) for feat in FEATURES}
    for bf in BINARY_FEATURES:
        defaults[bf] = int(df[bf].mode().iloc[0])
    return defaults
