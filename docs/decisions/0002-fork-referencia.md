# ADR-0002 — Fork da referência como ponto de partida

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O cliente pediu que o artefato "razoavelmente se inspire" no primeiro artefato
(`allexfernand/Modulo2-G6`), com a inspiração **clara**, mas sem que ele seja uma limitação.

## Decisão
**Forkar** `allexfernand/Modulo2-G6` → `igorregoir-lgtm/Modulo2-G6` (mantendo o nome, para preservar
o vínculo visível "forked from" como evidência de inspiração) e evoluí-lo substancialmente:
SHAP local/global, agente LLM (advisor + tutor), arquétipos, calibração, threshold por custo,
auditoria, governança LGPD, e novo frontend Next.js + Supabase.

## Opções consideradas
1. Repositório novo do zero (rejeitado: perde a rastreabilidade de inspiração pedida).
2. Fork mantendo nome (**escolhido**).
3. Fork renomeado (rejeitado nesta entrega: o vínculo "fork de" fica menos evidente).

## Consequências
- Herdamos o `backend/services/` (logistic, RF, XGBoost, LightGBM, kmeans, pipeline, preprocessing)
  como base do pipeline de treino.
- A evolução supera as lacunas do original (sem SHAP, sem LLM, sem banco, sem auditoria).
