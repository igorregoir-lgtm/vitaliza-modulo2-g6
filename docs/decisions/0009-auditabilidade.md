# ADR-0009 — Auditabilidade de ponta a ponta

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O cliente determinou que o artefato **deve ser auditável** e que **cada decisão** seja registrada.

## Decisão
Camadas de auditoria:
1. **Decision log (ADRs)** em `docs/decisions/` — esta pasta.
2. **Matriz de rastreabilidade** `docs/traceability-matrix.md` — requisito → componente → fundamentação.
3. **Model card** `docs/model_card.md` — escopo, dados, limites, métricas, princípios de decisão.
4. **`audit_log` (Supabase):** cada previsão e ação registrada (input anonimizado, score, threshold,
   `model_version`, explicação, decisão, outcome, ator, timestamp).
5. **Versionamento:** `model_version` + hash do dataset + data de treino em `metrics.json` e no banco.
6. **Reprodutibilidade:** lockfile (`uv.lock`/`requirements.lock`), seeds fixas, dataset versionado.

## Consequências
- Qualquer previsão pode ser reconstruída e justificada (LGPD/ANPD).
- Trade-off: custo de logging e schema adicionais — aceito por ser requisito do cliente.
