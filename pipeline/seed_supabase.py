"""Seed Supabase com a base de 4.000 clientes + scores do modelo.

Pipeline de INFERÊNCIA em lote (separado do treino): carrega o modelo serializado
via pipeline.inference, pontua cada cliente do dataset e popula as tabelas
`customer` e `score` no Supabase (service_role, ignora RLS).

Uso:  python -m pipeline.seed_supabase
Idempotente: limpa customer (cascata) antes de inserir.
"""
from __future__ import annotations
import json
from pathlib import Path

import pandas as pd
from supabase import create_client

from pipeline import inference

ROOT = Path(__file__).resolve().parents[1]
CHUNK = 250


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


def native(v):
    return v.item() if hasattr(v, "item") else v


def main() -> None:
    env = load_env()
    sb = create_client(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    df = pd.read_csv(ROOT / "data" / "gym_churn_us.csv")
    rows = df.to_dict(orient="records")
    print(f"dataset: {len(rows)} linhas")

    # idempotência: limpa a base (cascata remove score/explanation/intervention)
    sb.table("customer").delete().neq("id", 0).execute()
    print("customer/score limpos")

    # 1) customers
    customers = []
    for i, r in enumerate(rows):
        feats = {k: native(v) for k, v in r.items() if k != "Churn"}
        customers.append(
            {"external_ref": f"VZ{i:04d}", "features": feats, "true_churn": int(r["Churn"])}
        )
    ext_to_id: dict[str, int] = {}
    for ch in chunks(customers, CHUNK):
        res = sb.table("customer").insert(ch).execute()
        for row in res.data:
            ext_to_id[row["external_ref"]] = row["id"]
    print(f"customers inseridos: {len(ext_to_id)}")

    # 2) scores (pontuação do modelo)
    scores = []
    for i, r in enumerate(rows):
        feats = {k: native(v) for k, v in r.items() if k != "Churn"}
        pred = inference.predict(feats)
        arch = pred["archetype"]  # dict: {archetype, proactive_allowed, ...}
        scores.append(
            {
                "customer_id": ext_to_id[f"VZ{i:04d}"],
                "churn_probability": round(float(pred["churn_probability"]), 5),
                "risk_tier": pred["risk_tier"],
                "archetype": arch["archetype"],
                "proactive_allowed": bool(arch["proactive_allowed"]),
                "threshold": round(float(pred["threshold"]), 5),
                "model_version": pred["model_version"],
            }
        )
        if (i + 1) % 500 == 0:
            print(f"  pontuados {i + 1}/{len(rows)}")
    inserted = 0
    for ch in chunks(scores, CHUNK):
        res = sb.table("score").insert(ch).execute()
        inserted += len(res.data)
    print(f"scores inseridos: {inserted}")

    # resumo de distribuição
    dist: dict[str, int] = {}
    for s in scores:
        dist[s["risk_tier"]] = dist.get(s["risk_tier"], 0) + 1
    print("distribuição por tier:", json.dumps(dist, ensure_ascii=False))


if __name__ == "__main__":
    main()
