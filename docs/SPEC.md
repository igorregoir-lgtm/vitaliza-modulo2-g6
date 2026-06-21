# SPEC — Sistema de Inteligência de Retenção de Clientes (Vitaliza)

> **Artefato 2 — Trilha de Tecnologia (Inteli, Módulo 2).** Documento de especificação
> dirigida (spec-driven). É a fonte de verdade do artefato e a base de auditabilidade.
> Toda decisão de arquitetura está registrada em [`docs/decisions/`](decisions/) (ADRs) e a
> cobertura do checklist em [`docs/traceability-matrix.md`](traceability-matrix.md).

- **Versão:** 0.1 (em construção) · **Data:** 2026-06-17 · **Status:** Living document
- **Stack:** Next.js (App Router) + Tailwind + shadcn/ui na Vercel · Vercel Python Functions
  (inferência) · Supabase (Postgres + Auth + Storage) · Marimo (notebook) · OpenRouter (LLM)
- **Inspiração (não-limitante):** fork de `allexfernand/Modulo2-G6` →
  [`igorregoir-lgtm/Modulo2-G6`](https://github.com/igorregoir-lgtm/Modulo2-G6)

---

## 1. Contexto e propósito

A **Vitaliza** é uma assinatura de bem-estar/fitness com churn mensal de **10,2%** (63% acima da
meta interna de 6,2%), LTV/CAC de **2,02** (abaixo do piso de 3,0 exigido pela Série B) e ratchet
anti-diluição ativo. O artefato é um **Sistema de Inteligência de Retenção de Clientes**: prevê o risco de
churn por usuário, **explica** a previsão (global e individual), traduz a explicação em
**linguagem natural empática** e a converte em **recomendação prescritiva de retenção**, dentro de
uma camada **pedagógica (PBL)** que ensina o "como" e o "porquê" de cada etapa.

O sistema deve estar **em consonância com o artefato de negócio** (Vitaliza Board Recommendation):
os segmentos S1–S4, a regra "não acorde o cão que dorme" (sleeping dogs), os números do case, e a
governança LGPD/ANPD são parte do produto, não pano de fundo.

### Resultado pretendido
Um produto único, **demonstravelmente funcional e no ar**, utilizável por Customer Success,
Produto e Liderança, **auditável** de ponta a ponta (decisões, dados, modelo, previsões e ações).

---

## 2. Regras Mestras (do enunciado oficial — obrigatórias, sem exceção)

| # | Regra | Como o artefato atende |
|---|-------|------------------------|
| RM1 | **PBL**: cada etapa é uma oportunidade de aprendizado ("como" e "porquê"); definir o método pedagógico | Camada "Aprender" em cada tela + agente tutor; cada funcionalidade traz um cartão *Por que isto existe / Como funciona* (ver §8, §9) |
| RM2 | Explicar **por que cada funcionalidade foi escolhida** e como ajuda no aprendizado | Cartões pedagógicos + `docs/SPEC.md` §9 + `model_card.md` |
| RM3 | Usar a **lógica de empatia/aprendizado dos produtos allla** | Tom empático do agente, copy acolhedora, "humano no loop" (ver §8) |
| RM4 | Usar a **paleta de cores allla**, **sem nenhuma menção à marca allla** | Tokens de design derivados da paleta, zero string "allla" no produto ([ADR-0010](decisions/0010-paleta-sem-marca.md)) |
| RM5 | Atender o **checklist** abaixo, cada ponto **didaticamente explicado** e perceptível no artefato | §3 + matriz de rastreabilidade |

---

## 3. Checklist oficial (Semana 9, slides 11–12) — escopo obrigatório

> Fonte normativa: `Trilha de Tecnologia / Semana 9 - Aula 09 - Explicabilidade com LLM.pptx`
> (slides 11–12) e `Entregáveis de Tecnologia Módulo 2`. Cada item será **explicado in-app**.

1. **Modelo de churn validado** — sem overfit · sem vazamento (leakage) · métricas adequadas
2. **Explicabilidade do modelo** — SHAP values · feature importances · explicação em linguagem natural
3. **Serviço web** — serve a inferência · aderente aos requisitos de deploy
4. **Código fonte** — disponível (GitHub) · dividido em **pipeline de treinamento** e **pipeline de
   inferência**, com a inferência usando **arquivo serializado (joblib)**
5. **Demonstração de funcionalidade** — link com o sistema no ar (e vídeo, se necessário)

A matriz [`docs/traceability-matrix.md`](traceability-matrix.md) liga **cada item → componente do
artefato → fundamentação na Trilha**.

---

## 4. Pontos da Avaliação do Professor (manter + melhorar — sem exceção)

**Preservar (pontos positivos destacados):** completude técnica; organização das telas;
integração dashboard ↔ modelo ↔ análise de negócio; documentação de uso; personas; insights
acionáveis; inferência; evidências formais da análise.

**Implementar (melhoria pedida):** aprofundar a **explicabilidade das previsões individuais** —
deixar claro **quais variáveis pesaram em cada caso**, **quais fatores são acionáveis** pela
operação, e **converter a explicação em uma recomendação prática de retenção**. → Endereçado pela
Tela 3 (Consulta Individual) com waterfall SHAP por usuário + agente advisor (Função A/B, §8).

---

## 5. Arquitetura

```
                          ┌──────────────────────────── Vercel ────────────────────────────┐
  Browser (CS/Exec) ───►  │  Next.js App Router (4 telas + /principios-de-personalizacao)   │
                          │   ├─ Server Components / Route Handlers                          │
                          │   ├─ Vercel Python Functions  (/api/predict, /explain, /recommend│
                          │   │     /cohort-stats, /eda-summary) — carregam joblib + SHAP    │
                          │   └─ Agente IA (tutor + advisor) ─── server-side ──► OpenRouter  │
                          └───────────────┬─────────────────────────────────────────────────┘
                                          │ (service role / RLS)
                          ┌───────────────▼──────────── Supabase ───────────────────────────┐
                          │  Postgres (scores, explanations, interventions, audit_log,       │
                          │            principios, users/roles)  +  RLS por perfil            │
                          │  Auth (CS vê carteira, Exec vê agregado)                          │
                          │  Storage (modelo joblib, shap_values, eda artifacts)             │
                          └──────────────────────────────────────────────────────────────────┘

  Offline (Python 3.12 / uv):  Marimo EDA ──► train_mvp.py / train_final.py ──► joblib + SHAP
                               (pipeline de TREINAMENTO; artefatos versionados em Storage)
```

- **Treinamento** (offline, Python): notebook **Marimo** (`notebooks/eda_vitaliza.py`) +
  `pipeline/train_mvp.py` + `pipeline/train_final.py`. Produz `model.joblib`, `preprocess.joblib`,
  `shap_explainer.joblib`/valores e `metrics.json`. Export do notebook → `01_eda_vitaliza.ipynb`
  (deliverable nomeado pelo enunciado).
- **Inferência** (online, Vercel Python Function): carrega os artefatos serializados, aplica o
  **mesmo** pré-processamento do treino (anti-leakage), devolve `{churn_probability, risk_tier,
  shap_local, top_drivers, arquétipo}`.
- **Persistência/Auditoria** (Supabase): cada previsão e cada ação ficam registradas.

Detalhe e justificativa em [ADR-0001](decisions/0001-stack-vercel-supabase-nextjs.md) e
[ADR-0005](decisions/0005-inferencia-vercel-python-joblib.md).

---

## 6. Dados

- **Fonte única:** `data/gym_churn_us.csv` — **4.000 registros × 14 colunas**, churn **26,5%**
  (2.939 não-churn / 1.061 churn). Origem: arquivo fornecido pelo cliente ([ADR-0003](decisions/0003-dataset-fornecido.md)).
- **Colunas:** `gender, Near_Location, Partner, Promo_friends, Phone, Contract_period,
  Group_visits, Age, Avg_additional_charges_total, Month_to_end_contract, Lifetime,
  Avg_class_frequency_total, Avg_class_frequency_current_month, Churn(alvo)`.
- **Mapeamento ao case Vitaliza:** `Lifetime`→tempo de assinatura; `Avg_class_frequency_*`→
  frequência semanal (lifetime vs mês corrente); `Contract_period`→tipo de contrato {1,6,12};
  `Group_visits`→participação em desafios; `Promo_friends`→indicação; `Partner`→convênio;
  `Avg_additional_charges_total`→gasto em adicionais.
- **Features derivadas (case-críticas):** `ratio_freq_atual_vs_lifetime` (queda de engajamento),
  `flag_early_user` (Lifetime ≤ 1), `flag_sleeping_dog` (Lifetime > 6 **e** freq_atual < 0,5),
  `delta_freq`, interações contrato×tempo.

---

## 7. Metodologia de modelagem (com fundamentação da Trilha)

### 7.1 EDA (Etapa 1) — notebook **Marimo**
Carga/inspeção (`info/describe/shape/isnull`), limpeza (winsorização p99, encoding, duplicatas),
features derivadas, **6 visualizações** (churn por contrato; sobrevivência Kaplan-Meier;
boxplot freq mês-corrente por churn; heatmap de correlação; scatter freq_lifetime×freq_atual com
sleeping dogs; churn por cohort) e **segmentação** (early droppers, sleeping dogs, anuais uso-zero).
Entregáveis: `notebooks/eda_vitaliza.py` (Marimo) → `01_eda_vitaliza.ipynb`; `eda_report.md` (10
insights acionáveis). *Fundamentação:* Semanas 2–4.

### 7.2 Validação — sem overfit · sem vazamento · métricas adequadas
- **Overfit:** split estratificado 70/15/15 + **k-fold (k=5)**; comparar treino×val×teste; tuning
  (Optuna) com early stopping; reportar o gap. *Fundamentação:* Semanas 6–7.
- **Vazamento (leakage):** auditoria explícita de proxies da target e variáveis futuras —
  atenção a `Month_to_end_contract` e `Lifetime` (risco de quase-leakage que infla a AUC do
  artefato de referência ≈ 0,965); pré-processamento **fit no treino apenas**, reaplicado igual na
  inferência. Documentar conclusão por variável. *Fundamentação:* Semanas 3, 6, 7.
- **Métricas:** primárias **ROC-AUC** e **PR-AUC**; secundárias recall (classe churn), F1, lift no
  decil superior; **threshold por custo** (FP de acordar sleeping dog vs FN de perder recuperável);
  **calibração** (CalibratedClassifierCV) para o score ter leitura de risco. Metas: MVP ROC-AUC
  ≥ 0,75; **Final ROC-AUC ≥ 0,82 e recall ≥ 0,70**. *Fundamentação:* Semana 6.

### 7.3 Pipelines separados + serialização (requisito normativo)
- `pipeline/train_*.py` (TREINO) e `pipeline/inference.py` (INFERÊNCIA) **separados**; inferência
  consome **`model.joblib`** (+ `preprocess.joblib`). *Fundamentação:* Semanas 5, 7, 9 (slide 12).

---

## 8. Explicabilidade + Agente de IA (educacional e empático)

### 8.1 SHAP + feature importances
`shap.TreeExplainer` sobre o modelo final → **global** (summary/beeswarm + bar de importâncias) e
**local por usuário** (waterfall). Valores SHAP por usuário pré-computados e persistidos (Supabase)
para consulta rápida; SHAP ao vivo para inputs ad-hoc. *Fundamentação:* Semanas 8–9.

### 8.2 Agente IA — dois modos (OpenRouter, sempre server-side)
- **Modo Tutor (educacional/empático, RM1–RM3):** explica o "como/porquê" de cada etapa do PBL,
  responde dúvidas do usuário sobre o sistema, com tom acolhedor e linguagem acessível.
- **Modo Advisor (a melhoria do professor):**
  - **Função A — Explicação narrativa:** recebe `{features, shap_values, score, arquétipo}` e
    gera, em ≤150 palavras e **sem jargão**, *por que* o usuário está em risco, **quais variáveis
    pesaram** e **quais são acionáveis**. *Guardrail:* não afirmar causalidade (SHAP descreve o
    modelo, não o mundo — Semana 9).
  - **Função B — Recomendação prescritiva:** dado o input + catálogo de intervenções, retorna
    **oferta personalizada + copy + canal + timing**. *Guardrails:* sem desconto acima do teto;
    **nunca** intervir em `sleeping_dog`; máx. 2 canais/cliente; respeitar segmentação prévia.

Fundamento acadêmico da Função A: paper "Enhancing the Interpretability of SHAP Values Using LLMs"
(Trilha S9). [ADR-0006](decisions/0006-explicabilidade-shap-llm.md), [ADR-0007](decisions/0007-openrouter-segredo.md).

### 8.3 Arquétipos acionáveis (5)
`preço_sensível, desengajado_conteúdo, early_dropper, sleeping_dog, concorrente_driven` — combinação
de score + drivers SHAP dominantes + regras de negócio. Cada arquétipo tem política de intervenção;
`sleeping_dog` é **excluído** da camada proativa (guardrail "don't wake the sleeping dogs").
[ADR-0008](decisions/0008-arquetipos-sleeping-dog.md).

---

## 9. Aplicação web (4 telas + governança) — cada tela explica o "porquê"

1. **Dashboard Executivo (Conselho/CFO):** KPIs (churn mensal, LTV, LTV/CAC, retenção mês 6, meta
   6,0%), evolução do score médio, split por tier, **simulador de ROI** (sliders taxa de aceite ×
   custo da intervenção → receita preservada).
2. **EDA Interativa (Produto/Dados):** as 6 visualizações em Plotly com filtros (cohort, contrato),
   seleção de subgrupo, export CSV.
3. **Consulta Individual (Customer Success):** `user_id` → score, tier, **waterfall SHAP**,
   explicação narrativa (LLM), **recomendação prescritiva** (LLM), botão "Aplicar intervenção"
   (registra no banco). Comparáveis lado a lado. *(Atende a melhoria do professor.)*
4. **Visão de Carteira (Liderança/CS):** lista ranqueada por risco, filtro por arquétipo, ação em
   lote, **bloqueio explícito de sleeping_dogs** com link para a política.
5. **`/principios-de-personalizacao` (público, LGPD):** quais dados, com que finalidade, como
   contestar — cumprindo a recomendação da DPO / ANPD 07/2025.

Cada tela traz um bloco **"Aprender"** (cartão pedagógico) explicando a funcionalidade e a teoria.

---

## 10. Auditabilidade e governança (requisito explícito do cliente)

O artefato **deve ser auditável**. Mecanismos:
- **Decision log (ADRs):** [`docs/decisions/`](decisions/) — cada decisão com contexto, opções e
  consequência.
- **Matriz de rastreabilidade:** checklist/requisito → componente → fundamentação.
- **Model card:** `docs/model_card.md` — escopo, dados, limites, métricas, princípios de decisão
  (exigência tipo-ANPD).
- **Log de previsões (Supabase `audit_log`):** input (anonimizado), score, threshold, versão do
  modelo, explicação, decisão tomada, outcome, timestamp, ator — para retreino e auditoria LGPD.
- **Versionamento de modelo:** `model_version`, hash dos dados, data de treino em `metrics.json` e
  no banco.
- **Reprodutibilidade:** `requirements.lock`/`uv.lock`, seeds fixas, dataset versionado.

---

## 11. Segurança

- **OpenRouter API key** é **segredo**: `.env.local` (gitignored), env var na Vercel, **chamadas
  só server-side** (nunca no browser, nunca commitada). `.gitignore` bloqueia `.env*`/`*API*Key*`.
- A chave trafegou em texto puro (prompt + docx) → **recomenda-se rotacioná-la** após a entrega.
- Supabase: segredos em env; RLS por perfil; service role só server-side. [ADR-0007](decisions/0007-openrouter-segredo.md).

---

## 12. Não-objetivos (escopo controlado)
- Não há cobrança/pagamento real, envio real de e-mail/push (intervenções são **registradas**,
  integrações SendGrid/Mixpanel ficam como ponto de extensão).
- Sem PII real: dataset é anonimizado/sintético.
- Sem retreino automático em produção (retreino é manual/offline + monitoramento de drift leve).

---

## 13. Plano faseado (execução)
1. **Fundações & auditoria:** fork ✓, SPEC, ADRs, traceability, dataset ✓.
2. **EDA (Marimo):** notebook + `eda_report.md` (10 insights) + export `.ipynb`.
3. **Modelo:** `train_mvp.py` → `train_final.py` (Optuna, k-fold, calibração, threshold por custo);
   auditoria de overfit/leakage; `model.joblib` + `metrics.json` + `model_card.md`.
4. **Explicabilidade + Agente:** SHAP global/local; `llm_advisor` (A/B) + tutor; arquétipos.
5. **Web (Next.js + Supabase):** schema + Auth/RLS + 4 telas + página LGPD + paleta; Python
   Functions de inferência.
6. **Deploy:** Vercel + Supabase no ar; demonstração (link) + README + runbook.
7. **Fechamento de auditoria:** model card final, matriz completa, decision log completo.
```
