# ADR-0006 — Explicabilidade: SHAP (global+local) + linguagem natural via LLM

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
Checklist exige SHAP values, feature importances e explicação em linguagem natural. O professor
pediu **aprofundar a explicabilidade individual** (quais variáveis pesaram, quais são acionáveis,
virar recomendação prática). Fundamento: Trilha S8–S9 + paper arXiv "Enhancing the Interpretability
of SHAP Values Using LLMs".

## Decisão
- **Global:** `shap.TreeExplainer` → summary/beeswarm + bar de importâncias.
- **Local:** waterfall por usuário; valores SHAP por usuário **pré-computados** e persistidos
  (Supabase) para consulta rápida; SHAP ao vivo para inputs ad-hoc.
- **NL:** LLM (OpenRouter) traduz `{features, shap, score, arquétipo}` em explicação ≤150 palavras,
  sem jargão. **Guardrail:** não afirmar **causalidade** (SHAP explica o modelo, não o mundo) e não
  inventar fatores ausentes.
- **Acionabilidade:** cada driver marcado como **acionável** (ex.: frequência) ou **não-acionável**
  (ex.: tempo de assinatura) — base da recomendação prescritiva (ADR-0008).

## Consequências
- A Tela 3 (Consulta Individual) materializa a melhoria do professor.
- Distinção acionável/não-acionável vira metadado do modelo, auditável.
