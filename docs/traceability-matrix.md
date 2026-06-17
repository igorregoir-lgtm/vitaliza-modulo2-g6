# Matriz de Rastreabilidade — Vitaliza

Liga **cada requisito** (checklist oficial + melhoria do professor + regras mestras) ao **componente**
do artefato que o cumpre e à **fundamentação** na Trilha de Tecnologia / artefato de negócio.
Status: ☐ pendente · ◐ em construção · ☑ pronto.

## A. Checklist oficial (Semana 9, slides 11–12)

| # | Requisito | Componente do artefato | Fundamentação (Trilha) | Status |
|---|-----------|------------------------|------------------------|--------|
| A1 | Modelo de churn validado — **sem overfit** | `pipeline/train_final.py`: split 70/15/15 + k-fold(5) + Optuna early-stopping; gap treino×teste reportado em `metrics.json` | S6 (bias-variance, cross-val), S7 (tuning) | ◐ |
| A2 | … **sem vazamento (leakage)** | `pipeline/preprocessing.py` (fit só no treino) + seção "auditoria de leakage" no notebook/model_card (proxies + variáveis futuras: `Month_to_end_contract`, `Lifetime`) | S3, S6 (variáveis futuras/proxies), S7 | ◐ |
| A3 | … **métricas adequadas** | ROC-AUC, PR-AUC, recall, F1, lift, calibração, threshold por custo → `metrics.json` + Dashboard | S6 (desbalanceamento, ROC/PR-AUC, threshold) | ◐ |
| A4 | Explicabilidade — **SHAP values** | `pipeline/shap_service.py` (global summary/beeswarm + local waterfall) | S8, S9 | ☐ |
| A5 | … **feature importances** | importâncias do modelo final na EDA + Dashboard | S8, S9 | ☐ |
| A6 | … **explicação em linguagem natural** | `agent/llm_advisor` Função A (OpenRouter) | S9 (paper SHAP+LLM) | ☐ |
| A7 | Serviço web — **serve a inferência** | Vercel Python Function `/api/predict` | S7, S8 (cenário 2/3A) | ☐ |
| A8 | … **aderente a requisitos de deploy** | contrato de entrada validado, versão do modelo, threshold, logging, Vercel deploy | S7 (requisitos de produção), S8 | ☐ |
| A9 | Código fonte — **treino × inferência separados + joblib** | `pipeline/train_*.py` × `api/predict.py` + `model.joblib` | S5, S7, S9 (slide 12, normativo) | ◐ |
| A10 | **Demonstração funcional** | link Vercel no ar + README/runbook (+ vídeo se necessário) | S6 (entregável), S9 (slide 12) | ☐ |

## B. Avaliação do Professor

| # | Item | Componente | Status |
|---|------|-----------|--------|
| B1 | Preservar: completude técnica | escopo integral do checklist | ◐ |
| B2 | Preservar: organização das telas | 4 telas Next.js + navegação | ☐ |
| B3 | Preservar: integração dashboard↔modelo↔negócio | dados do modelo nas 4 telas + KPIs de negócio | ☐ |
| B4 | Preservar: documentação de uso | README + runbook + cartões "Aprender" | ☐ |
| B5 | Preservar: personas / arquétipos | 5 arquétipos (ADR-0008) | ☐ |
| B6 | Preservar: insights acionáveis | `eda_report.md` (10 insights) + recomendações | ☐ |
| B7 | Preservar: inferência | `/api/predict` | ☐ |
| B8 | Preservar: evidências formais | `metrics.json`, model card, SHAP plots | ☐ |
| **B9** | **MELHORIA: explicabilidade individual → acionável → recomendação prática** | **Tela 3 (waterfall SHAP por usuário) + advisor Função A/B (acionável + oferta/copy/canal/timing)** | ☐ |

## C. Regras Mestras

| # | Regra | Componente | Status |
|---|-------|-----------|--------|
| C1 | PBL ("como" e "porquê") | cartões "Aprender" por tela + agente tutor | ☐ |
| C2 | Justificar escolha de cada funcionalidade | cartões + SPEC §9 + model card | ◐ |
| C3 | Empatia/aprendizado (lógica allla) | tom do agente + copy acolhedora | ☐ |
| C4 | Paleta allla, sem marca | design tokens (ADR-0010); `grep -ri allla` vazio no app | ☐ |
| C5 | Checklist didaticamente explicado | cada item tem explicação in-app | ◐ |

## D. Consonância com o artefato de negócio (Vitaliza PDF)

| Item de negócio | Onde aparece no artefato | Status |
|-----------------|--------------------------|--------|
| Segmentos S1–S4 / arquétipos | segmentação + Visão de Carteira | ☐ |
| "Não acorde o cão que dorme" (sleeping dogs) | guardrail no advisor + bloqueio na Tela 4 (ADR-0008) | ☐ |
| Mensal cancela 17× o anual / contrato | EDA + features + recomendação (migração anual) | ☐ |
| Simulador de ROI (matemática do delta R$) | Tela 1 (Dashboard Executivo) | ☐ |
| LGPD / ANPD 07/2025 / princípios de personalização | página pública `/principios-de-personalizacao` | ☐ |
| Empatia / comunidade corta churn pela metade | copy + insights + intervenções de comunidade | ☐ |
