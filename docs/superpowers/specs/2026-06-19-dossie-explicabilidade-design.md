# Dossiê de Explicabilidade ("O Artefato") — Design

> Spec de feature. Status: **aprovado** (brainstorming, 2026-06-19). Repagina a aba
> `/principios-de-personalizacao` num **dossiê narrativo** que explica o sistema de ponta a ponta
> para uma banca de exame (padrão de rigor "doutorado Stanford"), gerando o momento 'aha'.
> Segue [ADR-0010](../../decisions/0010-paleta-sem-marca.md) (paleta **sem marca**). Consolida o que
> já existe (model card, ADRs, matriz de rastreabilidade, specs, telas) — **linka, não duplica**.

## 1. Contexto e objetivo
O artefato é avaliado **sem demo ao vivo**: o avaliador abre o sistema sozinho. Falta uma **porta de
entrada de explicabilidade** que: (a) diga o que é o sistema e as dores que ataca; (b) dê a descrição
técnica completa; (c) explique a lógica da Trilha; (d) exponha o rigor e a honestidade do modelo; e
(e) crie o momento 'aha' — fazendo a banca pensar *"isto não é um modelo de churn de aluno; é um
sistema de retenção auditável, que deixa manipular o raciocínio do modelo ao vivo, prova que sua
métrica não é leakage, sabe quando NÃO agir, e se ensina."*

**Princípio-guia: mostrar > contar.** Cada seção aponta para o artefato vivo (Simulador, estação
Avaliar, etc.) e para a evidência documental (model card, ADRs).

## 2. Decisão central — repaginar a aba existente, sem quebrar a URL
- Mantém a rota **`/principios-de-personalizacao`** (não quebra links/ADRs/roteiro-demo).
- Renomeia o item de menu **"Princípios (LGPD)" → "O Artefato"** (ícone de dossiê), e o reposiciona
  como **primeiro/segundo** item natural de leitura *(decisão de ordem na implementação; default:
  manter posição atual; o conteúdo é que muda)*.
- A **LGPD/ANPD** (conteúdo público atual) **vira a seção 7** do dossiê — nada se perde.
- pt-BR; long-form editorial com **índice fixo** (âncoras); **imprimível** (vira o PDF da defesa).

## 3. Honestidade dos dados (regra dura)
Todo número exibido vem de fonte verificável e é **fiel** ao repo (metrics.json, leakage-audit.json,
model-honesty.md, eda-data.json). Linguagem do sistema mantida: explicabilidade descreve o
**comportamento do modelo, não causalidade**. **Zero overclaim** — qualquer afirmação não
sustentável pelo repo é cortada (verificação adversarial obrigatória, §11).

## 4. Arquitetura — arquivos
**Conteúdo/dados (fonte única, evita o problema de `*.joblib`/`/pipeline/`/`/docs/` no `.vercelignore`):**
- `lib/dossie/facts.ts` — números verificados (métricas de teste, A/B de leakage, base rate,
  threshold, Brier se houver) + os links de evidência. **Fonte única** dos fatos da página.
- `lib/dossie/sections.ts` — config das seções `{ id, label }` (ordem) → alimenta o índice e as
  âncoras (fonte única do índice).

**Componentes (novos, `components/dossie/`):**
- `dossie-nav.tsx` — índice fixo (desktop: rail sticky; mobile: barra/colapsável). `no-print`.
  Âncoras `#<id>`; realce da seção ativa é desejável mas opcional (scroll-spy simples).
- `section.tsx` — `<Section id eyebrow title>`: casca de seção (âncora + cabeçalho consistente).
- `kpi-stat.tsx` — número grande + rótulo + dica (destaque de métrica).
- `evidence-link.tsx` — chip "ver evidência" (deep link p/ tela viva ou doc), com ícone.
- `flow-diagram.tsx` — diagrama simples do fluxo (SVG/CSS, tokens; dados → modelo → SHAP → advisor →
  ação → auditoria; + tutor + trilha).
- `callout.tsx` — bloco de destaque accent para os beats de revelação.

**Páginas / shell (alterados):**
- `app/(app)/principios-de-personalizacao/page.tsx` — reescrita (server component): compõe as 10
  seções; injeta `facts`; reusa o conteúdo LGPD atual na seção 7; botão "Imprimir / salvar PDF".
- `components/app-shell.tsx` — renomear o item do `NAV` ("O Artefato") + ícone.

## 5. Seções (narrativa — fonte: `lib/dossie/sections.ts`)
Ids/âncoras estáveis; ordem:
1. `tese` — **Tese / gancho** + 4 provas em destaque (KpiStat/Callout).
2. `problema` — **O problema e as dores** (magnitude + custo + 4 dores).
3. `solucao` — **A solução + visão geral** (uma frase + `flow-diagram`).
4. `arquitetura` — **Arquitetura técnica** (stack, treino×inferência+joblib, dados, telas; → ADRs).
5. `modelo` — **O modelo & o rigor** (métricas de teste; threshold por custo; **A/B de leakage**;
   calibração/Brier; honestidade do surrogate). → `model-honesty.md`, `/trilha/avaliar`.
6. `explicabilidade` — **Explicabilidade → ação** (SHAP; advisor A+B com guardrails; **Simulador
   Vivo**; otimizador; **uplift: risco ≠ quem abordar**). → `/individual`, `/trilha/avaliar`.
7. `etica` — **Ética & governança** (não-intrusão "cão que dorme"; guardrails em código; **LGPD/ANPD**
   — absorve o conteúdo atual da página).
8. `trilha` — **A lógica da Trilha** (Bloom + construtivismo + retrieval + productive failure; 6
   missões; overlay guiado). → `/trilha`.
9. `avaliar` — **Como avaliar este artefato** — tabela **requisito do checklist → evidência** (links
   vivos + docs). O fio que costura tudo e facilita a banca.
10. `decisoes` — **Decisões & auditabilidade** (decision log/ADRs; matriz de rastreabilidade; model
    card; audit_log).

## 6. Contratos pinados
```ts
// lib/dossie/sections.ts
export interface DossieSection { id: string; label: string; }
export const SECTIONS: DossieSection[]; // 10, ids únicos, ordem = ordem na página
```
```ts
// lib/dossie/facts.ts  (números verificados vs repo — §11)
export const MODEL_FACTS: {
  rocAucTest: number; recallTest: number; precisionTest: number;
  overfitGap: number; threshold: number;
  baseRateDataset: number; churnMonthlyCase: number;
  leakageAbDeltaAuc: number;          // 0.0000 (remover Month_to_end_contract)
  nDataset: number;                   // 4000
};
export interface Evidence { label: string; href: string; kind: "tela" | "doc"; }
export const EVIDENCE: Record<string, Evidence>; // chaves usadas pelos evidence-link
```
```tsx
// components/dossie/section.tsx
export function Section(props: { id: string; eyebrow: string; title: string; children: React.ReactNode }): JSX.Element;
```

## 7. Tratamento visual (ADR-0010, sem marca)
Tokens existentes apenas (`--accent*`, `--ink*`, `--paper*`, `--steel*`, `--rule`, `--tier-*`);
títulos serif, eyebrows mono, corpo em `--ink-soft` (não `steel`). KpiStat e Callout accent para os
beats de revelação. Índice fixo (`no-print`). Acessibilidade: `aria-current` no índice, âncoras
com `scroll-margin-top`, foco visível, `prefers-reduced-motion`. **Imprimível**: reusa
`@media print` (índice/botões `no-print`; seções imprimem como dossiê limpo).

## 8. Fontes de conteúdo (linkar, não duplicar)
`lib/dossie/facts.ts` consolida os números (de `metrics.json`, `leakage-audit.json`,
`model-honesty.md`, `eda-data.json`). Conteúdo LGPD reusa a fonte atual da página. Demais detalhes
**linkam** os docs/telas (model card, ADRs, traceability, roteiro-demo) para evitar divergência.
*(Não importar de `/pipeline/` nem `/docs/` — vercelignored; por isso os números vivem em `lib/`.)*

## 9. Edge cases / erros
- Índice + âncoras: todo `id` em `SECTIONS` existe como `<Section id>` (teste §11).
- Deep links para telas reais usam as rotas existentes; docs linkam caminhos do repo (GitHub).
- Sem dado dinâmico de servidor — a página é estática/seedável; nenhum fetch obrigatório.
- Impressão: nada essencial escondido por `no-print`.

## 10. Fora de escopo (YAGNI)
Sem widgets interativos embutidos (linka os vivos — Simulador/Avaliar); sem i18n (pt-BR); sem backend
novo; sem mudar a URL; sem PDF gerado em servidor (impressão do navegador basta).

## 11. Qualidade & verificação (ultracode)
- **Verificação adversarial de fatos:** cada afirmação factual da página é checada contra o repo
  (números, descrições técnicas, refs de ADR/arquivo). Veredito confirmado/errado/não-verificável;
  corrigir tudo que não for "confirmado". **Zero overclaim.**
- **Crítico de completude:** uma passada perguntando "o que falta para uma banca?" (modalidade não
  coberta, evidência sem link, claim sem lastro).
- **Testes (vitest):** `sections.test.ts` (10 ids únicos, labels não-vazios); `facts.test.ts` (campos
  presentes, ranges sãos — ex.: 0≤prob≤1). `eslint` + `next build` verdes; smoke no app + impressão.

## 12. Plano de implementação (fatias)
1. **Fundação:** `lib/dossie/{facts,sections}.ts` (+ testes) + `components/dossie/{section,kpi-stat,
   evidence-link,callout,flow-diagram,dossie-nav}.tsx`.
2. **Página:** reescrever `principios-de-personalizacao/page.tsx` com as 10 seções (LGPD na 7) +
   botão imprimir; renomear o item no `app-shell`.
3. **Verificação adversarial** (Workflow): fatos + completude → correções.
4. **Gate:** lint + testes + build; smoke + impressão; commit (trailer `Agent: Claude Code`); deploy.
