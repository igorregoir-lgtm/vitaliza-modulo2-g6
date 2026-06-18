# Vitaliza — Sistema de Inteligência de Retenção

Predição de churn **explicável** + **recomendação prescritiva** de retenção, com um **agente de IA
educacional e empático** (PBL), para uma assinatura de bem-estar/fitness (case Vitaliza).
Artefato 2 — Trilha de Tecnologia (Inteli, Módulo 2).

🔗 **Sistema no ar:** https://vitaliza-retencao.vercel.app
🔓 **Acesso aberto** — sem necessidade de login (modo demonstração). O gate de autenticação por
perfil (CS/Exec) existe no código (`lib/supabase/middleware.ts`, `lib/auth.ts`) e pode ser reativado.
📄 **Especificação:** [`docs/SPEC.md`](docs/SPEC.md) · **Decisões:** [`docs/decisions/`](docs/decisions) ·
**Rastreabilidade:** [`docs/traceability-matrix.md`](docs/traceability-matrix.md) ·
**Model card:** [`docs/model_card.md`](docs/model_card.md)

> Inspirado em [`allexfernand/Modulo2-G6`](https://github.com/allexfernand/Modulo2-G6) (fork), evoluído
> com SHAP local/global, agente LLM, arquétipos, calibração, governança LGPD e auditoria.

---

## O que o sistema faz (e como atende ao checklist)

| Checklist oficial | Onde está | 
|---|---|
| **Modelo de churn validado** (sem overfit, sem vazamento, métricas) | `pipeline/train_final.py` · XGBoost+Optuna(k-fold), calibração, threshold por custo. **TEST ROC-AUC 0,988 · recall 0,95 · overfit gap 0,010**. Auditoria de leakage removeu `Month_to_end_contract`. Ver [`docs/model_card.md`](docs/model_card.md). |
| **Explicabilidade** (SHAP, feature importances, linguagem natural) | `pipeline/shap_service.py` (global + local) · narrativa via agente LLM (`lib/agent.ts`, Função A). |
| **Serviço web** (serve a inferência, aderente ao deploy) | App Next.js na Vercel + dados/escores reais no Supabase; inferência em lote servida via API (padrão S7). |
| **Código fonte** (treino × inferência separados + joblib) | `pipeline/train_*.py` (treino) × `pipeline/inference.py` (inferência) carregando `model.joblib`. |
| **Demonstração funcional** | Link no ar acima + esta documentação. |

**Melhoria pedida pelo professor — explicabilidade individual → acionável → recomendação prática:**
materializada na tela **Consulta Individual** (waterfall SHAP por usuário, drivers marcados como
acionáveis/não-acionáveis, e recomendação prescritiva oferta/canal/copy/timing via agente). Estendida
pelo **Simulador Vivo** (abaixo): de *explicar* a previsão para *explorar* o que muda o risco, ao vivo.

---

## Telas

1. **Dashboard Executivo** — KPIs (churn, LTV, LTV/CAC, retenção mês 6, meta 6%), split por risco,
   **simulador de ROI** (taxa de aceite × custo → receita preservada).
2. **EDA Interativa** — 6 visualizações reais do dataset (churn por contrato, sobrevivência, frequência,
   correlação, scatter com sleeping dogs, cohort).
3. **Consulta Individual (CS)** — score + tier + **SHAP waterfall** + explicação narrativa + **recomendação**.
   Inclui o **Simulador Vivo + otimizador**: arraste alavancas acionáveis (frequência de aulas, desafios em
   grupo, duração do plano, meses até o fim) e veja score, waterfall SHAP e arquétipo recalcularem **ao vivo**
   (client-side). Os botões **"Simular esta alavanca"** (anima a alavanca sugerida ao vivo) e **"Tutor Explica"** (explicação do tutor em texto, com áudio opcional) tornam o efeito autoexplicativo.
   A projeção ancora no XGBoost real e aplica só o delta do surrogate transparente — descreve o comportamento
   do modelo, não causalidade. Spec: [`docs/superpowers/specs/2026-06-17-simulador-vivo-design.md`](docs/superpowers/specs/2026-06-17-simulador-vivo-design.md) ·
   ancoragem: [`docs/decisions/0014-ancoragem-simulador-real-mais-delta.md`](docs/decisions/0014-ancoragem-simulador-real-mais-delta.md).
4. **Visão de Carteira** — ranking por risco, filtro por arquétipo, **bloqueio de sleeping dogs** (não-intrusão).
5. **/principios-de-personalizacao** — página pública (LGPD/ANPD 07/2025), sem login.

Cada tela traz um cartão **"Aprender"** (PBL): explica o "como" e o "porquê", podendo conversar com o
**agente tutor** (empático, sem jargão).

---

## Arquitetura

- **Front + API:** Next.js (App Router) na **Vercel** · paleta neutra + Fraunces/IBM Plex/JetBrains Mono.
- **Dados/Auth:** **Supabase** (Postgres + RLS + Auth por perfil CS/Exec) — `customer`, `score`,
  `explanation`, `intervention`, `audit_log`, `principios`.
- **Agente IA:** tutor conversacional em **DeepSeek** (`/api/tutor`, escopo restrito ao repositório) e
  advisor prescritivo em **OpenRouter** (`/api/agent`), **sempre server-side**, com guardrails em código
  (sleeping_dog excluído, teto de desconto, máx. 2 canais).
- **Voz (TTS):** camada server-side **ElevenLabs + Google Cloud TTS** com fallback automático e
  **voz do navegador** como degradação — ver [`docs/voice-tts.md`](docs/voice-tts.md).
- **ML (offline):** Python 3.12 — notebook **Marimo** (`notebooks/eda_vitaliza.py` → `01_eda_vitaliza.ipynb`),
  treino, SHAP, serialização `joblib`. Inferência em lote pontua os 4.000 clientes → Supabase.

Decisão de arquitetura de inferência (lote real + simulador): ver
[`docs/decisions/0011-inferencia-batch-vs-online.md`](docs/decisions/0011-inferencia-batch-vs-online.md).

---

## Rodar localmente

```bash
# 1) Front (Node 20+)
cp .env.example .env.local   # preencha Supabase + OpenRouter
npm install
npm run dev                  # http://localhost:3000

# 2) ML (Python 3.12) — opcional, para retreinar/repontuar
uv venv --python 3.12 .venv
uv pip install scikit-learn xgboost lightgbm shap pandas numpy matplotlib seaborn plotly optuna joblib marimo lifelines supabase
.venv/Scripts/python -m pipeline.train_final     # treina + serializa model.joblib
.venv/Scripts/python -m pipeline.seed_supabase   # pontua 4.000 clientes -> Supabase
.venv/Scripts/python -m pipeline.seed_phase2     # SHAP por cliente + agregados de EDA
```

Operação, deploy e troubleshooting: [`docs/runbook.md`](docs/runbook.md).

---

## Estrutura

```
app/, components/, lib/      # Next.js (telas, UI, dados, agente)
pipeline/                    # ML: treino, inferência, SHAP, arquétipos, seeds
pipeline/artifacts/          # model.joblib, metrics.json, SHAP plots
notebooks/                   # eda_vitaliza.py (Marimo) + 01_eda_vitaliza.ipynb
supabase/migrations/         # schema + RLS + auditoria
docs/                        # SPEC, ADRs, traceability, model_card, runbook
data/                        # gym_churn_us.csv (4.000 × 14) — git-ignored
legacy/                      # artefato original (FastAPI + vanilla) preservado
```

> **Segurança:** segredos só em `.env.local` (git-ignored) e nas env vars da Vercel; nunca no cliente.
> A chave OpenRouter trafegou em texto puro durante a construção — **recomenda-se rotacioná-la**.
