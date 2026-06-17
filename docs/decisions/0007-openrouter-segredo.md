# ADR-0007 — OpenRouter via env/server-side; chave como segredo

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O agente de IA usa a **OpenRouter API**. A chave foi fornecida em texto puro (prompt do cliente **e**
docx oficial). A Trilha (S9) alerta para o risco de exposição de chave de API.

## Decisão
- A chave vive **apenas como segredo**: `.env.local` (gitignored) em dev; **env var na Vercel**
  (e Supabase secrets, se Edge Functions); **nunca** commitada, **nunca** no browser.
- Todas as chamadas LLM são **server-side** (Vercel Function / Route Handler).
- `.gitignore` bloqueia `.env*` e `*API*Key*` (já configurado na raiz do produto).
- **Recomendação:** **rotacionar a chave** após a entrega, pois trafegou em texto puro.

## Consequências
- Nenhum segredo no repositório público.
- Custo/limite de uso controlado por roteamento server-side; modelos selecionáveis sem reescrever
  integração (vantagem do gateway OpenRouter).
