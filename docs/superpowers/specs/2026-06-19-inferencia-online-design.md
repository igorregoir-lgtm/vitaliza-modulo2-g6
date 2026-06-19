# Inferência online do XGBoost no what-if — Design

> Spec de design. Status: **aprovado como design; implementação ADIADA** (ver
> [ADR-0017](../../decisions/0017-inferencia-online-design-adiada.md)). Fecha (no futuro) o maior
> asterisco do sistema: o what-if usa hoje o surrogate transparente, não o XGBoost real online
> ([ADR-0011](../../decisions/0011-inferencia-batch-vs-online.md), [ADR-0014](../../decisions/0014-ancoragem-simulador-real-mais-delta.md)).

## 1. Contexto e objetivo
O score exibido do membro é o **XGBoost real** (lote, Supabase). Mas o **what-if** (Simulador Vivo)
recalcula com a **heurística transparente** ancorada no score real. Objetivo: fazer o what-if usar o
**modelo de produção** para features arbitrárias (com os overrides das alavancas).

## 2. O desafio central — SHAP on-the-fly, não o score
- **Score real online é viável:** dado um vetor de features (já com overrides), rodar `model.joblib`
  devolve a probabilidade real. Barato.
- **SHAP local real online é o difícil:** o waterfall por membro hoje é **pré-computado** em lote e
  guardado no Supabase. Para um what-if com features editadas, o SHAP teria que ser **recalculado a
  cada ajuste** — `shap.TreeExplainer` em Python por request. É exatamente o custo que a ADR-0011
  evitou. **Este é o gargalo**, não o score.

## 3. Caminhos
- **A) Vercel Python Function** (`api/predict.py`, runtime Python da Vercel): carrega
  `model.joblib` + `preprocess.joblib` + `shap.TreeExplainer`; entrada = features+overrides; saída =
  `{prob, shap_local}`. **Prós:** reusa `pipeline/` as-is. **Contras:** bundle pesado
  (`xgboost`+`shap`+`sklearn`+`numpy`) perto/acima do limite de função serverless da Vercel; cold
  start; convive de forma frágil com as rotas App Router do Next.
- **B) ONNX no edge/Node** (`onnxruntime-node` numa API route Next): exporta XGBoost→ONNX; **score
  real rápido e leve**. **Contras:** SHAP em JS não existe pronto → o waterfall teria que vir de
  outra via.
- **C) Híbrido (recomendado):** **score real** por A ou B + **manter o waterfall do surrogate**
  rotulado como aproximação. Fecha ~80% do gap (o número passa a ser real) com risco bem menor.

## 4. Fallback obrigatório (zero regressão)
Qualquer caminho mantém o comportamento atual como rede: se a função falhar/der timeout, o simulador
cai na **heurística ancorada** (hoje). Atrás de uma flag (`NEXT_PUBLIC_ONLINE_INFERENCE`), default off.

## 5. Riscos
- **Quebrar o deploy de produção** (config do builder Python/`vercel.json`) — alto. → testar em
  **preview deployment**, nunca direto em `main`.
- Bundle size / cold start / custo por invocação.
- Divergência número-real (função) × waterfall-surrogate se ficar no híbrido — mitigar com rótulo.

## 6. Plano por fases
1. **Função de score real isolada** (`api/predict`) + teste em **preview** (medir cold start/tamanho).
2. **Wire no simulador** atrás da flag, com fallback para a heurística; A/B do número real vs ancorado.
3. **Decidir SHAP:** real (TreeExplainer na função, se couber no orçamento) vs manter aproximação do
   surrogate (híbrido).
4. Promover a `main` só após preview verde; atualizar ADR-0011/0014.

## 7. Decisão desta entrega
**Adiar a implementação** e manter o surrogate (ADR-0017): os ganhos não justificam o risco de
derromper a produção do artefato perto da avaliação, e o SHAP on-the-fly é um projeto à parte. O
design acima fica pronto para execução guiada por preview.
