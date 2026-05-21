import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from ..preprocessing import FEATURE_LABELS, FEATURES


def run(df: pd.DataFrame, params: dict) -> dict:
    n_clusters = int(params.get("n_clusters", 4))
    n_clusters = max(2, min(n_clusters, 6))

    X = df[FEATURES].copy()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)

    df = df.copy()
    df["cluster"] = labels

    inertia = float(km.inertia_)
    silhouette = float(silhouette_score(X_scaled, labels)) if n_clusters > 1 else 0.0

    segments = []
    for cluster_id in range(n_clusters):
        mask = df["cluster"] == cluster_id
        subset = df[mask]
        churn_rate = (
            float(subset["Churn"].mean()) if "Churn" in subset.columns else None
        )
        profile = {feat: round(float(subset[feat].mean()), 3) for feat in FEATURES}
        segments.append(
            {
                "cluster": cluster_id,
                "label": f"Segmento {cluster_id + 1}",
                "count": int(mask.sum()),
                "churn_rate": round(churn_rate, 4) if churn_rate is not None else None,
                "profile": profile,
            }
        )

    # Assign risk labels by churn_rate rank
    valid = [s for s in segments if s["churn_rate"] is not None]
    risk_labels = [
        "Alto Risco",
        "Risco Médio-Alto",
        "Risco Médio-Baixo",
        "Baixo Risco",
        "Muito Baixo Risco",
        "Estável",
    ]
    for i, seg in enumerate(sorted(valid, key=lambda s: s["churn_rate"], reverse=True)):
        seg["risk_label"] = risk_labels[i] if i < len(risk_labels) else f"Grupo {i+1}"

    # Heatmap: normalized mean per feature per cluster
    heatmap = []
    for feat in FEATURES:
        values = [round(float(df[df["cluster"] == c][feat].mean()), 3) for c in range(n_clusters)]
        max_val = max(values) if max(values) != 0 else 1
        heatmap.append(
            {
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "values": values,
                "normalized": [round(v / max_val, 3) for v in values],
            }
        )

    return {
        "model_type": "unsupervised",
        "metrics": {
            "n_clusters": n_clusters,
            "inertia": round(inertia, 2),
            "silhouette_score": round(silhouette, 4),
        },
        "segments": segments,
        "heatmap": heatmap,
        "feature_importance": [],
        "predictions": [
            {"index": int(i), "cluster": int(labels[i])} for i in range(min(len(labels), 500))
        ],
    }
