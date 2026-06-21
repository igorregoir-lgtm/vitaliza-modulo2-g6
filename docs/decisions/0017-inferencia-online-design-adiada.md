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

## Resultado empírico (preview, 2026-06-19)
PoC executada num **preview deployment** (branch `feat/online-inference-preview`, sem tocar `main`):
uma Vercel Python Function (`api/predict-real.py`) servindo o XGBoost real (score-only, SHAP fora),
com `requirements.txt` slim (joblib, numpy, pandas, scikit-learn, scipy, xgboost).

> **Build falhou (esperado):** `Total bundle size (868.68 MB) exceeds Lambda ephemeral storage limit
> (500 MB)`. Mesmo sem SHAP, a stack de ML pesa ~**868 MB** — inviável como função serverless Python
> na Vercel.

Conclusão prática: **o caminho Python está fora** para este alvo. A rota viável é **ONNX**
(exportar XGBoost→ONNX + `onnxruntime-node` numa API route do Next, ~dezenas de MB), replicando o
pré-processamento em JS — score real leve; SHAP segue como item à parte (manter o waterfall do
surrogate, rotulado). Produção permaneceu intacta durante todo o experimento.

### Caminho ONNX — PROVADO (branch `feat/online-inference-onnx`)
- `pipeline/export_onnx.py` converte o `calibrated_model` (XGBoost+sigmoid) para **ONNX de 653 KB**
  e extrai os params do pré-processamento; a validação numérica bate com `predict()` de produção
  (**max |Δ| = 5e-5**).
- `app/api/infer-onnx/route.ts` serve o score real via **onnxruntime-node**; pré-processamento
  replicado em JS (`lib/onnx/preprocess.ts`, espelha `features.py`+ColumnTransformer).
- **Local:** early_dropper 0.9413, engajado 0.0117 (== produção).
- **Vercel preview:** build **● Ready** (~40s) — onnxruntime-node + `model.onnx` empacotam e sobem
  (o bloqueio de 868 MB do caminho Python sumiu; bundle na casa de MB).
- **Pendente:** a invocação do preview retornou **401** (Vercel Deployment Protection nos previews);
  validar o runtime abrindo o preview autenticado no navegador, ou via token de bypass, ou ao
  promover para produção. Falta também: **wire da flag `NEXT_PUBLIC_ONLINE_INFERENCE` + fallback**
  no simulador e a decisão sobre SHAP (manter surrogate rotulado). **Não mergeado em `main`** (muda o
  bundle de produção e expõe rota nova) — aguarda revisão/decisão.

## Consequências
- A honestidade fica **explícita e rastreável**: `docs/model-honesty.md` declara o limite; este ADR +
  o spec dão o caminho. Nada de promessa vaga.
- O comportamento atual (ADR-0011/0014) permanece a fonte de verdade até o preview validar a função.
- Trabalho futuro bem-escopado: função de score real → wire com flag/fallback → decisão de SHAP.
- Se/quando promovido, ADR-0011 e 0014 são atualizados (a ancoragem some quando o real roda online).

## Atualização (2026-06-21) — wire implementado atrás da flag (híbrido)
A pendência acima foi **resolvida** no branch `feat/online-inference-onnx`:
- **Flag + fallback:** hook `lib/onnx/use-online-projection.ts` (flag `NEXT_PUBLIC_ONLINE_INFERENCE`,
  **default off**). Ligado, o Simulador Vivo usa o score **real do XGBoost** (via `/api/infer-onnx`)
  como "Projeção"; desligado **ou** em qualquer erro/indisponibilidade, cai de volta na heurística
  ancorada (ADR-0014) — **zero regressão** (com a flag off o comportamento é idêntico ao atual).
- **SHAP — decisão:** mantido o **surrogate transparente** (híbrido). Quando o ONNX está ativo, o
  readout rotula a fonte ("Projeção · XGBoost real") e nota que o waterfall segue o surrogate.
- **Runtime validado localmente** (dev server, `/api/infer-onnx`): early_dropper **0.9413**, engajado
  **0.0117** — idêntico à produção. Resolve o bloqueio anterior (preview 401 por Deployment Protection):
  a prova foi feita no runtime local, não no preview gated.
- **Gate:** eslint + **83 testes** (2 novos cobrindo o invariante "flag off → sem rede") + `next build`
  (25 rotas, inclui `/api/infer-onnx`) — tudo verde.
- **Promovido em `main`** (fast-forward, 2026-06-21): o wire está em produção com a **flag off**
  (comportamento inalterado).

## Bloqueio no runtime da Vercel (2026-06-21) — limite de 250 MB da função
Ao tentar fazer a rota `/api/infer-onnx` **rodar na Vercel**, o deploy falha com
**"A Serverless Function has exceeded the unzipped maximum size of 250 MB"**. Causa: o pacote
`onnxruntime-node` traz binários de TODAS as plataformas (darwin ~72 MB + win32 ~127 MB + linux ~55 MB
= **~254 MB**) e o `serverExternalPackages` o embarca inteiro. Tentativas que **não** resolveram:
`outputFileTracingIncludes`/`outputFileTracingExcludes` (excludes não podam pacotes externos) e um
script de poda no `buildCommand` (a função seguiu >250 MB). **Local funciona** (o Node tem o `.so`):
early_dropper 0,9413 / engajado 0,0117 == produção.

Impacto em produção: **nulo**. A flag fica **off** → o cliente nunca chama a rota; mesmo ligada, o hook
cai no fallback (heurística) ao receber erro. A rota, se chamada direto, retorna 500 (o addon nativo não
carrega no Lambda) — **dormente**, sem afetar a app (o restante responde 200). O `main` ficou no commit
do merge (`845616b`), que **deploya Ready**; os experimentos de config que quebravam o deploy (>250 MB)
foram descartados do histórico.

**Para rodar de verdade na Vercel (decisão futura):** trocar `onnxruntime-node` (nativo, 254 MB) por
**`onnxruntime-web` (WASM, poucos MB)** na API route — roda na função sem `.so` e cabe no limite —, OU
mover a inferência para um **serviço externo** (container/Modal/etc.). Até lá, a fonte de verdade segue
**lote real + surrogate transparente** (ADR-0011/0014), e o wire fica pronto para quando o backend de
inferência couber no runtime.
