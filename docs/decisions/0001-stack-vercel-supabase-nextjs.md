# ADR-0001 — Stack: Vercel + Supabase + Next.js

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O enunciado oficial descreve uma referência em FastAPI + Streamlit/React + SQLite/Postgres +
Docker/Cloud Run. O cliente determinou explicitamente a **dobradinha Vercel + Supabase**. O artefato
de referência usa FastAPI (Render) + HTML estático (Vercel).

## Decisão
- **Frontend:** Next.js (App Router) + Tailwind + shadcn/ui na **Vercel**.
- **Inferência:** **Vercel Python Functions** (Fluid Compute, Python 3.12) carregando o modelo
  `joblib` — mantém o ML em Python (exigência do checklist) sem servidor Render.
- **Dados/Auth/Storage:** **Supabase** (Postgres + RLS + Auth + Storage).
- **Treino:** Python offline (Marimo + scripts), artefatos versionados em Supabase Storage.

## Opções consideradas
1. Manter FastAPI no Render (rejeitado: contraria a diretriz Vercel+Supabase).
2. Reescrever inferência em JS (rejeitado: perderia SHAP/joblib e a paridade com a Trilha).
3. **Vercel Python Functions + Next.js + Supabase (escolhido).**

## Consequências
- Drop de `render.yaml`. `vercel.json`/`.vercelignore` reescritos.
- Funções Python na Vercel têm limites de tamanho/cold-start → modelo enxuto + SHAP pré-computado.
- Ganho: deploy unificado, Auth/Postgres gerenciados, paleta/telas modernas.
