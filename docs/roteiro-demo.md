# Roteiro de demonstração — avaliar o artefato sozinho

> Para o avaliador percorrer o sistema **sem demo ao vivo**, em ~5 minutos, e
> chegar ao momento de autodescoberta ("ver a IA mudar de ideia"). Cada passo
> aponta a evidência de rigor (métricas, SHAP, LGPD, auditoria).
>
> **Sistema no ar:** https://vitaliza-retencao.vercel.app · **acesso aberto** (sem login).

## 0. Abrir
Acesse a URL acima. Não é preciso login (modo demonstração). Em cada tela há um
cartão **"Aprender"** (PBL) explicando o "como" e o "porquê" — e um agente tutor.

## 1. Dashboard executivo — `/` (redireciona p/ `/dashboard`)
Veja os KPIs (churn, LTV, LTV/CAC, retenção mês 6, meta 6%), o split por risco e o
**simulador de ROI** (taxa de aceite × custo → receita preservada).
- **Rigor:** os números vêm de escores reais servidos do Supabase (inferência em
  lote do XGBoost — [ADR-0011](decisions/0011-inferencia-batch-vs-online.md)).

## 2. EDA interativa — `/eda`
Percorra as 6 visualizações do dataset (churn por contrato, sobrevivência,
frequência, correlação, scatter com sleeping dogs, cohort).
- **Rigor:** EDA reprodutível (`notebooks/eda_vitaliza.py`); insights em
  `eda_report.md`.

## 3. Visão de carteira — `/carteira`
Ordene por risco e filtre por arquétipo. Note o **bloqueio explícito de sleeping
dogs** (não-intrusão).
- **Rigor / LGPD:** guardrail "não acorde o cão que dorme"
  ([ADR-0008](decisions/0008-arquetipos-sleeping-dog.md)); 1,9% de churn nesse grupo.

## 4. Consulta individual — `/individual`  ← o ponto alto
1. Selecione um membro. Veja **score + tier + waterfall SHAP real** + explicação
   narrativa + recomendação prescritiva (oferta/canal/copy/timing).
2. Role até o card **"Simule uma Intervenção"** (aberto por padrão).
3. **Momento "what the hell":** clique em **"Simular esta alavanca"**. O sistema
   anima sozinho a alavanca mais barata sugerida pelo otimizador, **recalcula ao
   vivo** score, waterfall SHAP e arquétipo, e abre o **"Tutor Explica"** com a
   explicação em texto (áudio opcional pelo botão "Ouvir").
4. Em seguida, arraste você mesmo as alavancas acionáveis (frequência de aulas no
   mês, desafios em grupo, duração do plano, meses até o fim) e veja o arquétipo
   virar. Clique em **"Aplicar Intervenção"** para registrar (auditado).
- **Rigor (o que observar):**
  - O leitor antes→depois rotula **"Atual · XGBoost"** vs **"Projeção · simulação"**:
    a projeção **ancora no score real** e soma só o delta do surrogate transparente
    ([ADR-0014](decisions/0014-ancoragem-simulador-real-mais-delta.md);
    `model_card.md` §11). O XGBoost de produção **não é alterado**.
  - Disclaimer presente: *descreve o comportamento do modelo, não causalidade.*
  - O otimizador respeita **não-intrusão** (some para sleeping_dog).
  - **Auditoria:** "Aplicar intervenção" grava em `intervention` + `audit_log`
    (via `/api/apply-intervention`); sleeping_dog vira `bloqueada`.

## 5. Princípios de personalização — `/principios-de-personalizacao`
Página pública (LGPD / ANPD 07/2025): quais dados, com que finalidade, como contestar.

## Onde está a rigor (checagem rápida)
| Pergunta do avaliador | Onde conferir |
|---|---|
| Modelo validado, sem overfit/leakage, métricas? | [`docs/model_card.md`](model_card.md) (TEST ROC-AUC 0,988 · recall 0,95 · gap 0,010) |
| SHAP (global + local)? | EDA + waterfall por cliente; `model_card.md` §7 |
| Dois modelos (produção × simulação)? | `model_card.md` §11 + [ADR-0014](decisions/0014-ancoragem-simulador-real-mais-delta.md) |
| LGPD / sleeping dogs? | `/principios-de-personalizacao` + [ADR-0008](decisions/0008-arquetipos-sleeping-dog.md) |
| Decision log / auditabilidade? | [`docs/decisions/`](decisions/) + `audit_log` (Supabase) + [`docs/traceability-matrix.md`](traceability-matrix.md) |
| Cobertura requisito → componente? | [`docs/traceability-matrix.md`](traceability-matrix.md) (seções A–E) |
| Testes do simulador? | `lib/simulator/*.test.ts` (vitest, 28 testes) |
