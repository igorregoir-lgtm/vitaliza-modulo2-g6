# Vitaliza — Sistema de Inteligência de Retenção de Clientes

Sistema desenvolvido para a entrega do **Módulo 2 (Inteli)**, com foco em análise exploratória de
dados, **modelo preditivo de churn explicável** e uma camada acionável que traduz a previsão em
**recomendação prescritiva de retenção** — dentro de uma jornada pedagógica (PBL).

> Inspirado em [`allexfernand/Modulo2-G6`](https://github.com/allexfernand/Modulo2-G6) (fork),
> reimplementado em Next.js/Supabase e evoluído com **XGBoost + SHAP** (local/global), **agentes LLM**,
> **arquétipos comportamentais**, calibração, simulador what-if ao vivo, trilha pedagógica e
> governança LGPD/auditoria.

## Links Da Entrega

- **Site publicado:** https://vitaliza-retencao.vercel.app
- **Repositório GitHub:** https://github.com/igorregoir-lgtm/vitaliza-modulo2-g6
- **Trilha de Aprendizado** (porta de entrada pedagógica): https://vitaliza-retencao.vercel.app/trilha
- **Dossiê "O Artefato"** (explicabilidade ponta-a-ponta + LGPD): https://vitaliza-retencao.vercel.app/principios-de-personalizacao
- **Notebook EDA** (evidência formal): [`notebooks/01_eda_vitaliza.ipynb`](notebooks/01_eda_vitaliza.ipynb)
- **Relatório EDA** (insights acionáveis): [`eda_report.md`](eda_report.md)
- **Model card** e **honestidade do modelo:** [`docs/model_card.md`](docs/model_card.md) · [`docs/model-honesty.md`](docs/model-honesty.md)

> Observação: **acesso aberto, sem login** (modo demonstração). A API é servida pelo próprio app
> Next.js na Vercel (não há backend separado) — não há tempo de hibernação no primeiro acesso.

## Objetivo Do Projeto

O projeto estima o risco de churn de clientes de uma academia, **explica** cada previsão (global e
individual) e traduz os sinais do modelo em **ações de retenção**. A solução combina:

- Predição de churn com **XGBoost** calibrado, validado sem overfit e sem vazamento.
- Explicabilidade **SHAP** global e individual (waterfall por cliente).
- **Recomendação prescritiva** (oferta / canal / copy / timing) via agente LLM, com guardrails de negócio.
- **Simulador Vivo + otimizador** (what-if): arraste alavancas acionáveis e veja score, waterfall SHAP
  e arquétipo recalcularem **ao vivo**.
- **Arquétipos comportamentais** (5 personas acionáveis) para leitura de negócio.
- **Trilha de Aprendizado** (taxonomia de Bloom) guiada sobre as telas reais.
- **Dashboard EDA** com visualizações exploratórias.
- **Agente tutor** educacional e empático (PBL), com voz opcional.
- **Auditabilidade** (decision log + `audit_log`) e governança **LGPD**.

## Como Acessar E Testar

1. Acesse o site publicado: https://vitaliza-retencao.vercel.app
2. Comece pela aba **Trilha** (`/trilha`): jornada guiada em 6 missões (Entender → Explicar → Simular →
   Decidir → Avaliar → Sintetizar).
3. Veja o **Dashboard**: KPIs (churn, LTV, LTV/CAC, retenção mês 6, meta 6%), split por risco e
   **simulador de ROI** (taxa de aceite × custo → receita preservada).
4. Abra a **Consulta Individual**: selecione um cliente e veja **score + tier + waterfall SHAP** +
   explicação narrativa + **recomendação prescritiva**.
5. No card **"Simule uma Intervenção"**, clique em **"Simular esta alavanca"**: o sistema anima a
   alavanca sugerida pelo otimizador e **recalcula ao vivo**; use **"Tutor Explica"** para a leitura.
6. Veja a **Visão de Carteira**: ranking por risco, filtro por arquétipo e **bloqueio de sleeping dogs**
   (não-intrusão).
7. Explore a **EDA**: 6 visualizações reais do dataset (contrato, sobrevivência, frequência, correlação,
   sleeping dogs, cohort).
8. Leia o **dossiê "O Artefato"** (`/principios-de-personalizacao`): explicabilidade ponta-a-ponta +
   LGPD, página imprimível.
9. Use o **tutor** flutuante (texto ou voz) — escopo restrito ao projeto.

## Estrutura Do Repositório

```
vitaliza-modulo2-g6/
├── app/                       # Next.js (App Router) — telas e rotas de API
│   ├── (app)/                 # dashboard, individual, carteira, eda, trilha
│   ├── api/                   # inferência, SHAP, recomendação, agentes, TTS
│   └── principios-de-personalizacao/   # dossiê "O Artefato" + LGPD
├── components/                # UI (shadcn), simulador, trilha, tutor, dossiê
├── lib/                       # dados, agente LLM, simulador, scoring, tipos
├── pipeline/                  # ML: treino, inferência, SHAP, arquétipos, seeds
│   └── artifacts/             # model.joblib, metrics.json, gráficos SHAP
├── notebooks/                 # eda_vitaliza.py (Marimo) → 01_eda_vitaliza.ipynb
├── supabase/migrations/       # schema + RLS + auditoria
├── docs/                      # SPEC, ADRs, model_card, traceability, runbook
├── data/                      # gym_churn_us.csv (4.000 × 14) — git-ignored
├── legacy/                    # artefato original (FastAPI + vanilla) preservado
├── eda_report.md              # insights acionáveis da EDA
└── README.md
```

## Funcionalidades Principais

- **Dashboard Executivo:** KPIs de negócio, split por risco e simulador de ROI da retenção.
- **Consulta Individual:** score + tier + **waterfall SHAP** + explicação narrativa + recomendação
  prescritiva; inclui o **Simulador Vivo** (what-if narrado, recálculo client-side ancorado no XGBoost real).
- **Visão de Carteira:** ranking por risco, filtro por arquétipo e bloqueio de sleeping dogs.
- **EDA Interativa:** as 6 visualizações obrigatórias da análise, sobre o dataset real.
- **Trilha de Aprendizado:** jornada Bloom em 6 missões, com painel-guia, checks formativos e a estação
  **"Avaliar"** (explorador de **threshold** recall × FP × ROI + **curva de calibração**/Brier) e um
  **resumo executivo imprimível** (capstone).
- **Dossiê "O Artefato":** documento de explicabilidade nível-banca + LGPD, com links vivos e impressão em PDF.
- **Agente tutor:** conversacional, empático e didático (PBL), com voz opcional e escopo restrito.

## Stack Técnica

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Recharts.
- **Backend (API):** rotas Next.js (Vercel Functions), **sempre server-side**.
- **Dados e Auth:** **Supabase** (Postgres + RLS + Auth por perfil CS/Exec).
- **Machine Learning:** Python 3.12 — scikit-learn, **XGBoost** + Optuna (k-fold), **SHAP**, calibração;
  pandas, numpy, matplotlib, seaborn; notebook **Marimo**.
- **Agentes LLM:** **DeepSeek** (tutor) e **OpenRouter / Claude** (advisor prescritivo).
- **Voz (TTS):** **ElevenLabs + Google Cloud TTS** com fallback automático e voz do navegador como degradação.
- **Deploy:** **Vercel** (frontend + API), região `gru1`.

## Endpoints Do Backend

Servidos pelo próprio app Next.js (rotas em `app/api/`):

- `POST /api/predict` — pontua um cliente (probabilidade de churn calibrada).
- `GET /api/explain/[id]` — contribuições **SHAP** locais (waterfall) de um cliente.
- `POST /api/recommend` — recomendação prescritiva (oferta/canal/copy/timing) com guardrails.
- `POST /api/agent` — advisor prescritivo via LLM (OpenRouter).
- `POST /api/tutor` — agente tutor conversacional (DeepSeek), escopo restrito ao projeto.
- `POST /api/apply-intervention` — registra a intervenção escolhida (auditado em `audit_log`).
- `GET /api/cohort-stats` · `GET /api/eda-summary` — agregados para Dashboard e EDA.
- `GET /api/trilha-data` — pares (p, y) reais para o explorador de threshold + calibração.
- `POST /api/trilha-summary` — resumo executivo (capstone) via LLM.
- `GET | POST /api/tts` — status / síntese de voz.

## Métricas E Evidências

Na avaliação registrada do modelo (`pipeline/train_final.py` + `docs/model_card.md`):

- **ROC-AUC (teste): 0,988**
- **Recall (classe churn): 0,95**
- **Overfit gap: 0,010**
- **Vazamento auditado:** `Month_to_end_contract` **removido**; uma sonda A/B mostra que removê-la custa
  **AUC +0,0000** → o desempenho vem de engajamento legítimo, não de leakage
  (`docs/model-honesty.md` + `docs/leakage-audit.json`).
- **Calibração (Brier)** e **threshold por custo** (recall × FP × ROI) explorados na estação "Avaliar"
  da Trilha, sobre os escores reais.

> **Honestidade (sem overclaim):** o ROC-AUC alto é característica do dataset (sintético, 4.000 × 14) e
> **não generaliza** como número absoluto; o uplift exibido é **proxy** (sem RCT); o ROI é projeção.
> Detalhes no dossiê "O Artefato" e no model card.

O notebook `notebooks/01_eda_vitaliza.ipynb` guarda os outputs principais: carga e limpeza da base,
visualizações obrigatórias da EDA, features derivadas e métricas do modelo (ROC-AUC e classification report).

## Features Utilizadas Pelo Modelo

**Brutas** (do dataset `gym_churn_us.csv`):

- `Lifetime` — meses como cliente.
- `Avg_class_frequency_current_month` — frequência de aulas no mês atual.
- `Avg_class_frequency_total` — frequência histórica de aulas.
- `Age` — idade do cliente.
- `Contract_period` — duração do contrato.
- `Avg_additional_charges_total` — gastos extras na academia.
- `Group_visits` — participação em aulas em grupo.
- `Promo_friends` — entrada por indicação.
- `Partner` — vínculo com empresa parceira.
- `Near_Location` — proximidade da academia.
- *(removida por vazamento: `Month_to_end_contract`)*

**Derivadas** (leakage-safe, `pipeline/features.py`):

- `ratio_freq_atual_vs_lifetime` — frequência corrente ÷ histórica (`< 1` = queda de engajamento).
- `delta_freq` — corrente − histórica (negativo = desacelerando).
- `flag_early_user` — `Lifetime <= 1` (recém-chegado, risco de desistência inicial).
- `flag_sleeping_dog` — `Lifetime > 6` e freq corrente `< 0,5` (antigo hoje inativo).
- `contract_x_lifetime` — interação contrato × tempo de casa.

## Arquétipos Comportamentais

A camada de negócio classifica cada cliente em um de **5 arquétipos acionáveis** (`pipeline/archetypes.py`),
combinando score + drivers SHAP dominantes + regras, cada um com política de intervenção:

- **Preço-sensível** — risco puxado por contrato curto / gasto adicional / sem indicação. Política:
  oferta de plano anual com desconto dentro do teto.
- **Desengajado de conteúdo** — queda de frequência, mas ainda ativo. Política: reengajar por
  aulas/desafios em grupo e trilha personalizada.
- **Early dropper** — `Lifetime <= 1` e baixa frequência. Política: onboarding reforçado e acompanhamento
  próximo nas primeiras semanas.
- **Sleeping dog** — `Lifetime > 6` e freq corrente `< 0,5` (antigo hoje inativo). Política: **NÃO intervir
  proativamente** (guardrail "não acorde o cão que dorme") — a recomendação RECUSA oferta.
- **Concorrente-driven** — ativo, contrato ok, risco residual sem driver de engajamento. Política:
  reforço de valor / benefício de parceria e comunidade; evitar guerra de preço.

A regra de **sleeping dog** tem prioridade máxima (segurança > tudo).

## Execução Local

```bash
# Frontend (Node 20+)
cp .env.example .env.local        # preencha Supabase + OpenRouter/DeepSeek
npm install
npm run dev                       # http://localhost:3000
npm run lint && npm test          # eslint + 81 testes (vitest)
npm run build

# Pipeline ML (Python 3.12) — opcional, para retreinar/repontuar
uv venv --python 3.12 .venv
uv pip install scikit-learn xgboost shap pandas numpy matplotlib seaborn optuna joblib marimo lifelines supabase
.venv/Scripts/python -m pipeline.train_final     # treina + serializa model.joblib
.venv/Scripts/python -m pipeline.seed_supabase   # pontua 4.000 clientes -> Supabase
.venv/Scripts/python -m pipeline.seed_phase2     # SHAP por cliente + agregados de EDA
```

Operação, deploy e troubleshooting: [`docs/runbook.md`](docs/runbook.md).

## Observações Para Avaliação

- **Acesso aberto:** sem login (modo demonstração). O gate por perfil (CS/Exec) existe no código
  (`lib/supabase/middleware.ts`, `lib/auth.ts`) e pode ser reativado.
- O **site publicado** é o principal ponto de demonstração; o **dossiê "O Artefato"**
  (`/principios-de-personalizacao`) é a porta de entrada de explicabilidade para a banca; comece pela
  **Trilha** (`/trilha`) para a jornada pedagógica.
- **Treino × inferência separados** (`pipeline/train_*.py` × `pipeline/inference.py`, modelo serializado
  em `joblib`); a inferência em lote pontua os 4.000 clientes para o Supabase.
- **Honestidade do modelo** documentada, sem overclaim — ver [`docs/model-honesty.md`](docs/model-honesty.md)
  e [`docs/model_card.md`](docs/model_card.md).
- **Segurança:** segredos só em `.env.local` (git-ignored) e nas env vars da Vercel; nunca no cliente.
  Recomenda-se rotacionar a chave OpenRouter (trafegou em texto puro durante a construção).
