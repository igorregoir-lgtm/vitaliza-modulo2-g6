# ADR-0017 — Inferência online do XGBoost no what-if: design aprovado, implementação adiada

- **Status:** Accepted · **Data:** 2026-06-19

## Contexto
O maior asterisco de honestidade do sistema é o what-if: o Simulador Vivo recalcula com a heurística
transparente (ancorada no score real — [ADR-0014](0014-ancoragem-simulador-real-mais-delta.md)), não
com o XGBoost de produção rodando online. Levar o modelo real para o what-if foi pedido como
"next level". O design completo está em
[`docs/superpowers/specs/2026-06-19-inferencia-online-design.md`](../superpowers/specs/2026-06-19-inferencia-online-design.md).

Dois fatos pesam: (1) o **score** real online é viável, mas o **SHAP local** recalculado por request
para features arbitrárias é caro — é justamente o custo que a [ADR-0011](0011-inferencia-batch-vs-online.md)
evitou; (2) adicionar um runtime Python/ONNX + função serverless ao app Next é uma mudança de infra
que **pode quebrar o deploy de produção** se mal configurada.

## Decisão
**Aprovar o design e ADIAR a implementação**, mantendo por ora o lote real + surrogate transparente.
A execução, quando ocorrer, deve ser **validada em preview deployment** antes de tocar `main`, atrás
da flag `NEXT_PUBLIC_ONLINE_INFERENCE` (default off) e **com fallback** para a heurística (zero
regressão). Caminho recomendado: **híbrido** — score real + waterfall do surrogate rotulado como
aproximação.

## Opções consideradas
1. **Implementar agora, direto em `main`** (rejeitado): risco de derrubar a produção do artefato perto
   da avaliação; SHAP on-the-fly é um projeto à parte, não cabe num passo seguro.
2. **Nunca fazer** (rejeitado): perde o fechamento honesto do gap; deixa o asterisco sem rota.
3. **Design + adiar, execução guiada por preview (escolhido):** entrega a rota técnica completa e a
   decisão auditável, sem arriscar o sistema no ar.

## Consequências
- A honestidade fica **explícita e rastreável**: `docs/model-honesty.md` declara o limite; este ADR +
  o spec dão o caminho. Nada de promessa vaga.
- O comportamento atual (ADR-0011/0014) permanece a fonte de verdade até o preview validar a função.
- Trabalho futuro bem-escopado: função de score real → wire com flag/fallback → decisão de SHAP.
- Se/quando promovido, ADR-0011 e 0014 são atualizados (a ancoragem some quando o real roda online).
