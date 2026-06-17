# ADR-0011 — Inferência em lote (real) + simulador heurístico para what-if

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O checklist exige "serviço web que serve a inferência". A stack é Vercel + Supabase. O modelo é um
XGBoost calibrado + SHAP, cujas dependências Python (xgboost, shap, scikit-learn, scipy) são pesadas
para uma Vercel Python Function (risco de estourar o limite de tamanho de função e cold start).

## Decisão
**Inferência em lote (batch), servida via Supabase** — padrão ensinado na Trilha S7 ("inferência em
lote vs online"):
1. O pipeline offline (`pipeline/inference.py`) pontua os **4.000 clientes** do dataset com o modelo
   real (`model.joblib`) + SHAP local, e persiste em `score` + `explanation` no Supabase
   (`seed_supabase.py`, `seed_phase2.py`).
2. O app Next.js **serve** essas previsões/explicações reais (escore, tier, arquétipo, waterfall SHAP,
   drivers acionáveis) nas 4 telas e na API — é o modelo real servido pela web.
3. O formulário **"what-if" ad-hoc** (entradas arbitrárias fora da base) usa um **simulador heurístico
   transparente** (`lib/heuristic.ts`), **claramente rotulado**, pois exigiria o runtime Python pesado
   na borda. O agente LLM (narrativa + recomendação) é online e real (OpenRouter).

## Opções consideradas
1. Vercel Python Function com xgboost+shap (rejeitado nesta entrega: risco de tamanho/cold start →
   deploy instável).
2. Converter para ONNX e inferir em JS (custo alto p/ calibração + SHAP; futuro).
3. **Lote real servido + simulador para ad-hoc (escolhido)** — confiável, no ar, e alinhado à S7.

## Consequências
- A inferência servida (4.000 clientes + explicações) é **100% do modelo real**, auditável no banco.
- O what-if ad-hoc é didático (simulador), não o modelo de produção — rotulado para não confundir.
- Caminho de evolução: expor `pipeline/inference.py` como função online (ONNX ou container) sem mudar
  o contrato (`lib/api.ts`).
