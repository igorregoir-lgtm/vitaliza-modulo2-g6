# ADR-0008 — 5 arquétipos acionáveis + exclusão proativa de sleeping_dogs

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O artefato de negócio (Vitaliza) define segmentos S1–S4 e o princípio **"não acorde o cão que
dorme"**: usuários `Lifetime > 6m e freq < 0,5` (sleeping dogs) **não** podem receber campanha
proativa, sob risco de aumentar o churn.

## Decisão
Classificar cada usuário em um dos **5 arquétipos**: `preço_sensível, desengajado_conteúdo,
early_dropper, sleeping_dog, concorrente_driven` — via score do modelo + drivers SHAP dominantes +
regras de negócio (ex.: Lifetime ≤ 1 + freq < 1 → early_dropper). Cada arquétipo tem política de
intervenção; **`sleeping_dog` é excluído** de toda recomendação/campanha proativa (guardrail
obrigatório, validado em código e na UI — Tela 4 bloqueia a ação em lote para esse grupo).

## Consequências
- Guardrail testável: a Função B (recomendação) **recusa** gerar oferta para `sleeping_dog`.
- A Visão de Carteira mostra o bloqueio com link para a política pública (LGPD).
- Trigger de escalonamento documentado: cancelamentos de S2 > 20% após disparo → pausa.
