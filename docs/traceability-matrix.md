# Matriz de Rastreabilidade — Vitaliza

Liga **cada requisito** (checklist oficial + melhoria do professor + regras mestras) ao **componente**
do artefato que o cumpre e à **fundamentação** na Trilha de Tecnologia / artefato de negócio.
Status: ☑ pronto · ◐ em construção · ☐ pendente. **Sistema no ar:** https://vitaliza-retencao.vercel.app

## A. Checklist oficial (Semana 9, slides 11–12)

| # | Requisito | Componente do artefato | Fundamentação (Trilha) | Status |
|---|-----------|------------------------|------------------------|--------|
| A1 | Modelo de churn validado — **sem overfit** | `pipeline/train_final.py`: split 70/15/15 + k-fold(5) + Optuna; **gap treino−teste AUC = 0,010** em `metrics.json` | S6, S7 | ☑ |
| A2 | … **sem vazamento (leakage)** | `leakage_audit.py` + `preprocessing.py` (fit só no treino); **`Month_to_end_contract` removido** (corr. 0,97; ΔAUC 0,000) — `docs/model_card.md` | S3, S6, S7 | ☑ |
| A3 | … **métricas adequadas** | ROC-AUC 0,988 · PR-AUC 0,975 · recall 0,95 · F1 0,87 · lift 3,77 · calibração sigmoid · threshold por custo — `metrics.json` + Dashboard | S6 | ☑ |
| A4 | Explicabilidade — **SHAP values** | `shap_service.py` (global summary/beeswarm + local waterfall); SHAP por cliente em `explanation` | S8, S9 | ☑ |
| A5 | … **feature importances** | `shap_global.json` + plots; importâncias na EDA/Dashboard | S8, S9 | ☑ |
| A6 | … **explicação em linguagem natural** | `lib/agent.ts` Função A (OpenRouter `claude-sonnet-4.6`) — verificado no ar | S9 (paper SHAP+LLM) | ☑ |
| A7 | Serviço web — **serve a inferência** | App Next.js (Vercel) serve escores/explicações reais (inferência em lote, S7) via Supabase + API | S7, S8 | ☑ |
| A8 | … **aderente a requisitos de deploy** | contrato de entrada tipado, `model_version`, threshold, **audit_log**, deploy Vercel gru1 | S7, S8 | ☑ |
| A9 | Código fonte — **treino × inferência separados + joblib** | `pipeline/train_*.py` × `pipeline/inference.py` + `model.joblib` | S5, S7, S9 (slide 12) | ☑ |
| A10 | **Demonstração funcional** | Link no ar + README/runbook + login demo | S6, S9 | ☑ |

## B. Avaliação do Professor

| # | Item | Componente | Status |
|---|------|-----------|--------|
| B1 | Preservar: completude técnica | escopo integral do checklist (A1–A10) | ☑ |
| B2 | Preservar: organização das telas | 4 telas Next.js + shell/nav | ☑ |
| B3 | Preservar: integração dashboard↔modelo↔negócio | escores reais nas 4 telas + KPIs de negócio | ☑ |
| B4 | Preservar: documentação de uso | README + runbook + cartões "Aprender" | ☑ |
| B5 | Preservar: personas / arquétipos | 5 arquétipos (`archetypes.py`, ADR-0008) | ☑ |
| B6 | Preservar: insights acionáveis | `eda_report.md` (10 insights) + recomendações | ☑ |
| B7 | Preservar: inferência | escores reais servidos + `/api/predict` | ☑ |
| B8 | Preservar: evidências formais | `metrics.json`, `model_card.md`, SHAP plots | ☑ |
| **B9** | **MELHORIA: explicabilidade individual → acionável → recomendação prática** | **Tela Consulta Individual: waterfall SHAP real por cliente + drivers acionáveis + advisor (oferta/copy/canal/timing)** | ☑ |
| **B9.1** | **MELHORIA estendida: explicabilidade individual → laboratório what-if ao vivo** | **Simulador Vivo na Consulta Individual: arrastar alavancas acionáveis recalcula score, waterfall SHAP e arquétipo ao vivo (client-side) — fecha o loop na intervenção (ver §E)** | ☑ |

## C. Regras Mestras

| # | Regra | Componente | Status |
|---|-------|-----------|--------|
| C1 | PBL ("como" e "porquê") | cartões "Aprender" por tela + agente tutor | ☑ |
| C2 | Justificar escolha de cada funcionalidade | cartões + SPEC §9 + model card | ☑ |
| C3 | Empatia/aprendizado (lógica allla) | tom do agente tutor/advisor + copy acolhedora | ☑ |
| C4 | Paleta allla, **sem marca** | design tokens neutros (ADR-0010); zero string "allla" no app | ☑ |
| C5 | Checklist didaticamente explicado | cada item explicado in-app (cartões) | ☑ |

## D. Consonância com o artefato de negócio (Vitaliza PDF)

| Item de negócio | Onde aparece no artefato | Status |
|-----------------|--------------------------|--------|
| Segmentos S1–S4 / arquétipos | segmentação + Visão de Carteira | ☑ |
| "Não acorde o cão que dorme" (sleeping dogs) | guardrail no advisor (`runAdvisor`) + bloqueio na Carteira (ADR-0008) | ☑ |
| Mensal cancela 17× o anual / contrato | EDA (churn por contrato) + features + recomendação (migração anual) | ☑ |
| Simulador de ROI (matemática do delta R$) | Dashboard Executivo | ☑ |
| LGPD / ANPD 07/2025 / princípios de personalização | página pública `/principios-de-personalizacao` | ☑ |
| Empatia / comunidade corta churn pela metade | copy + insights + intervenções de comunidade | ☑ |

## E. Simulador Vivo + Otimizador (what-if narrado) — Consulta Individual

Estende a melhoria do professor (B9): de *explicar* uma previsão individual para
*explorar* o que muda o risco, ao vivo. **No ar:** https://vitaliza-retencao.vercel.app/individual

| # | Requisito atendido | Componente do artefato | Fundamentação / artefato | Status |
|---|--------------------|------------------------|--------------------------|--------|
| E1 | Explicabilidade individual **acionável** → recomendação: arrastar alavancas recalcula score, waterfall SHAP e arquétipo ao vivo (client-side) | `components/simulator/live-simulator.tsx`, `lever-controls.tsx`, `projection-readout.tsx`; `lib/simulator/levers.ts` (4 alavancas acionáveis) + `engine.ts` | Spec `docs/superpowers/specs/2026-06-17-simulador-vivo-design.md`; estende B9 | ☑ |
| E2 | **Honestidade de modelo auditável:** projeção ancora no XGBoost real e aplica só o delta do surrogate transparente (`projetado = clamp01(real + simNew − simBase)`); XGBoost de produção inalterado | `lib/simulator/engine.ts#projectAnchored`; `lib/heuristic.ts` (surrogate puro) | **ADR-0014**; ADR-0011; `docs/model_card.md` §11 | ☑ |
| E3 | **Otimizador** "alavanca mais barata" p/ baixar um tier; respeita não-intrusão (sleeping_dog / `proactive_allowed=false`) e o caso já-`baixo` | `lib/simulator/engine.ts#findCheapestLever`; `components/simulator/optimizer-hint.tsx` | §7 do spec; guardrail ADR-0008 | ☑ |
| E4 | **Experiência educacional / autodescoberta** ("Ver a IA mudar de ideia"): anima a alavanca sugerida até o alvo, recalcula ao vivo e narra; respeita `prefers-reduced-motion` | `live-simulator.tsx#runAutoDemo` | RM1 (PBL); §3 do spec | ☑ |
| E5 | **Explicação em linguagem natural por voz** (determinística, on-demand): "Ouvir o que mudou"; TTS ElevenLabs/Google com fallback p/ voz do navegador | `lib/simulator/narrate.ts#buildNarration`; `components/tutor/use-speak.ts` (extraído do tutor) | §5, §8 do spec; ADR-0013 | ☑ |
| E6 | **Auditabilidade:** "Aplicar intervenção" registra em `intervention` + `audit_log`; sleeping_dog registrado como `bloqueada` | `app/api/apply-intervention/route.ts`; `live-simulator.tsx#handleApply` | ADR-0009; ADR-0008; SPEC §10 | ☑ |
| E7 | **Evidência / sem regressão:** núcleo puro coberto por testes (ancoragem, monotonicidade, otimizador, não-intrusão, disclaimer da narração) | `lib/simulator/engine.test.ts` + `lib/simulator/narrate.test.ts` (vitest, 28 testes) | §11 do spec | ☑ |
| E8 | **Paleta sem marca** (RM4): reusa apenas tokens/`ui/*`; zero menção/logo allla | `components/simulator/*` (tokens `--accent`/`--ink`/`--tier-*`) | ADR-0010; §9 do spec | ☑ |
