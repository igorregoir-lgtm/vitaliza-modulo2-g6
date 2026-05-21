import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ..preprocessing import FEATURE_LABELS, FEATURES


def run(df: pd.DataFrame, params: dict) -> dict:
    X = df[FEATURES]
    y = df["Churn"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000, random_state=42)),
    ])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    all_proba = pipeline.predict_proba(X)[:, 1]

    clf = pipeline.named_steps["clf"]
    feature_importance = sorted(
        [
            {
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "importance": round(float(abs(coef)), 4),
                "coefficient": round(float(coef), 4),
                "direction": "aumenta churn" if coef > 0 else "reduz churn",
            }
            for feat, coef in zip(FEATURES, clf.coef_[0])
        ],
        key=lambda x: x["importance"],
        reverse=True,
    )

    return {
        "model_type": "supervised",
        "metrics": {
            "rows_used": int(len(df)),
            "test_rows": int(len(X_test)),
            "churn_rate": round(float(y.mean()), 4),
            "roc_auc": round(float(roc_auc_score(y_test, y_proba)), 4),
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
            "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        },
        "feature_importance": feature_importance,
        "segments": _build_risk_segments(df.copy(), all_proba),
        "heatmap": [],
        "predictions": [
            {"index": int(i), "probability": round(float(p), 4)}
            for i, p in enumerate(all_proba[:500])
        ],
        "_model": pipeline,
        "_feature_defaults": {feat: float(X[feat].median()) for feat in FEATURES},
    }


def _build_risk_segments(df: pd.DataFrame, probabilities) -> list[dict]:
    df["_prob"] = probabilities
    df["_risk"] = pd.cut(
        df["_prob"],
        bins=[-0.01, 0.4, 0.7, 1.01],
        labels=["Baixo Risco", "Risco Médio", "Alto Risco"],
    )
    segments = []
    for level in ["Alto Risco", "Risco Médio", "Baixo Risco"]:
        subset = df[df["_risk"] == level]
        if len(subset) == 0:
            continue
        segments.append(
            {
                "label": level,
                "count": int(len(subset)),
                "churn_rate": (
                    round(float(subset["Churn"].mean()), 4)
                    if "Churn" in subset.columns
                    else None
                ),
                "avg_probability": round(float(subset["_prob"].mean()), 4),
            }
        )
    return segments
