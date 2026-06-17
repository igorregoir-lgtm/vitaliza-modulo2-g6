# ADR-0010 — Paleta allla, sem qualquer menção à marca

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
Regra mestra RM4: usar a **paleta de cores da allla**, mas **sem nenhuma menção à marca allla** —
nem logo, nem nome, nem "allla" em qualquer string visível ou metadado do produto.

## Decisão
- Extrair os tokens de cor da identidade allla (via skill `allla-brand`) e expô-los como **design
  tokens neutros** (CSS variables / Tailwind theme), aplicados ao Next.js + shadcn.
- **Zero** ocorrência da string "allla" no produto entregue (UI, título, meta tags, README público,
  manifestos). O produto se apresenta como "Vitaliza — Inteligência de Retenção".
- A lógica de empatia/aprendizado dos produtos allla é incorporada ao **tom** do agente e da copy,
  sem nomear a marca.

## Consequências
- Verificação de conformidade: `grep -ri "allla"` no diretório do app deve retornar vazio (exceto
  fora do build, em docs internos de processo se necessário).
- Os tokens ficam documentados em `app/styles/tokens` para auditoria visual.
