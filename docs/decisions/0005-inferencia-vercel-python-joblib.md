# ADR-0005 — Inferência em Vercel Python Functions com `joblib`

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O checklist exige **pipeline de inferência separado do de treino**, consumindo um **arquivo
serializado (joblib)**. A stack é Vercel + Supabase.

## Decisão
Servir a inferência como **Vercel Python Function** (`api/predict.py` etc.), que:
1. carrega `model.joblib` + `preprocess.joblib` (de Supabase Storage / bundle);
2. aplica o **mesmo** pré-processamento do treino (proteção anti-leakage);
3. retorna `{churn_probability, risk_tier, top_drivers, shap_local, arquétipo}`;
4. registra a previsão em `audit_log` (Supabase).

Endpoints: `/api/predict`, `/api/explain`, `/api/recommend`, `/api/cohort-stats`, `/api/eda-summary`.

## Opções consideradas
1. Reimplementar inferência em TS (rejeitado: perde joblib/SHAP e paridade com a Trilha).
2. Serviço Python separado (Render) (rejeitado: contraria Vercel+Supabase / ADR-0001).
3. **Vercel Python Function + joblib (escolhido).**

## Consequências
- Atenção a tamanho do bundle / cold-start: modelo enxuto, SHAP pré-computado por usuário no banco.
- Garante separação treino↔inferência exigida pelo checklist (Semana 9, slide 12).
