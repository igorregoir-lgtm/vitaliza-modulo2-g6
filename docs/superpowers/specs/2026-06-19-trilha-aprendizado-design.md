# Trilha de Aprendizado (jornada pedagógica Bloom) — Design

> Spec de feature. Status: **aprovado** (brainstorming, 2026-06-18; design fechado pelo usuário 2026-06-19).
> Segue [ADR-0010](../../decisions/0010-paleta-sem-marca.md) (paleta allla **sem marca**) e reusa o
> Simulador Vivo ([spec](./2026-06-17-simulador-vivo-design.md), [ADR-0014](../../decisions/0014-ancoragem-simulador-real-mais-delta.md)).
> Registrar a decisão de arquitetura em **ADR-0015** (trilha como overlay guiado + progresso local, sem servidor).

## 1. Contexto e objetivo

O artefato é acadêmico e **não tem demo ao vivo**: o avaliador (e o aprendiz) abre o sistema sozinho.
Hoje o app é uma "ferramenta com explicações". Esta feature o transforma em **jornada pedagógica**
guiada, ancorada em quatro princípios de aprendizagem:

- **Taxonomia de Bloom** — a trilha sobe os degraus cognitivos: Entender → Analisar → Aplicar →
  Avaliar → Criar.
- **Construtivismo / faded scaffolding** — muito apoio no começo (guia detalhado), apoio que
  diminui a cada missão (o aprendiz assume o controle).
- **Retrieval practice / predict-first** — cada missão fecha com um *check formativo*: o aprendiz
  **prevê** antes de ver, depois recupera o que aprendeu; o tutor dá feedback.
- **Productive failure** — em Simular, "tente você primeiro" antes de revelar o ótimo.

O design funde três ideias do brainstorm — **Trilha (#1)** + **literacia de threshold (#2)** +
**casos contrastantes / contrafactual (#3)** — e acomoda **calibração/incerteza (#4)**,
**productive failure (#5)** e **resumo executivo (#6)** sem conflito.

**Propósito em camadas:** por padrão, um **tour curto (~10 min)** percorre as missões na ordem;
cada missão tem um **"aprofundar"** opcional. Atende a banca (rápido, completo) e o aprendiz (fundo).

## 2. Decisão central — overlay guiado + progresso local (→ ADR-0015)

A trilha **não recria telas**: ela **guia o aprendiz pelas telas reais** que já existem (Dashboard,
EDA, Consulta Individual), sobrepondo um **painel-guia** (objetivo + instrução + tutor) e um **check
formativo**. Só as estações que não têm tela equivalente (Avaliar = sistema; Síntese = capstone)
ganham rota própria sob `/trilha/*`.

- **Arquitetura híbrida:** capa/mapa `/trilha` (progresso) → cada missão abre a **tela real** com
  `?trilha=<id>` → o **GuideRail** (montado no `AppShell`) aparece quando há `?trilha=` na URL →
  ao concluir, abre o **StationCheck** → marca progresso → volta à capa.
- **Sem login, sem servidor de estado:** progresso em **`localStorage`** (`use-trilha-progress`).
  Degrada graciosamente (SSR: vazio até hidratar).
- **Uma única fonte de verdade** das missões (`lib/trilha/missions.ts`) alimenta a capa, o GuideRail
  e o StationCheck.
- **Honestidade de dados:** as estações quantitativas (threshold #2, calibração #4) usam os
  **escores REAIS** do modelo (`churn_probability` do XGBoost) + `true_churn` — não a heurística.
  Nada de causalidade: a linguagem descreve o comportamento do modelo (consistente com o tutor/advisor).

## 3. Mapa das missões (Bloom) + capstone

| # | Missão | Bloom | Tela-alvo (`?trilha=`) | Foco / módulos |
|---|--------|-------|------------------------|----------------|
| 1 | **Entender** | Understand | `/dashboard?trilha=entender` (aprofundar: `/eda`) | Churn como fenômeno: magnitude (10,2% mensal / 26,5% base do dataset), custo (ROI). *Semente de calibração.* |
| 2 | **Explicar** | Analyze | `/individual?trilha=explicar` | Por que ESTE membro (waterfall SHAP). **+ #3 casos contrastantes** (2 membros lado a lado). |
| 3 | **Simular** | Apply | `/individual?trilha=simular` | Simulador Vivo (já existe). **+ #5 "tente você primeiro" + #3 contrafactual.** |
| 4 | **Decidir** | Evaluate (micro) | `/individual?trilha=decidir` | Advisor + Aplicar: custo × benefício da AÇÃO; tie-in ROI; não-intrusão. |
| 5 | **Avaliar** | Evaluate (meta) | `/trilha/avaliar?trilha=avaliar` | Estação de sistema: **#2 trade-off do limiar** (corte → recall × falsos positivos × ROI) + **#4 calibração/incerteza** + ética da não-intrusão. |
| ★ | **Síntese** (Capstone) | Create | `/trilha/sintese?trilha=sintese` | **#6 resumo executivo** gerado pelo agente: "você desenhou uma estratégia de retenção", **imprimível**. |

Missões 2–4 reusam a **mesma** tela (`/individual`) com lentes diferentes: o GuideRail direciona a
atenção (waterfall → simulador → advisor) e o check muda por missão. Scaffolding **decrescente**:
missões 1–2 com instrução passo a passo; 4–5 mais enxutas.

## 4. Arquitetura — arquivos

**Novos — núcleo puro / dados (TDD):**
- `lib/trilha/missions.ts` — config das 6 estações (fonte única). **Sem** lógica de UI.
- `lib/trilha/threshold.ts` — `evaluateThreshold(points, cutoff, costs)` (matriz de confusão, recall,
  precisão, FPR, ROI proxy). **(#2)**
- `lib/trilha/calibration.ts` — `calibrationBins(points, nBins)`, `brierScore(points)`. **(#4)**
- `lib/trilha/threshold.test.ts`, `lib/trilha/calibration.test.ts` — vitest.

**Novos — endpoints:**
- `app/api/trilha-data/route.ts` — GET → `{ points: {p,y}[], baseRate, n, threshold }` a partir de
  `getScoredCustomers()` (filtra quem tem `true_churn != null`). **(#2/#4)**
- `app/api/trilha-summary/route.ts` — POST → resumo executivo do capstone via `lib/agent.ts`
  (prompt novo `runCapstoneSummary`), com fallback determinístico. **(#6)**

**Novos — client components / hook:**
- `components/trilha/use-trilha-progress.ts` — hook localStorage (`completed[]`, `current`, helpers).
- `components/trilha/trilha-map.tsx` — capa/mapa: estações, estado (feito/atual/bloqueado), progresso.
- `components/trilha/guide-rail.tsx` — painel-guia (objetivo + instrução + tutor + "Concluir missão");
  dispara o StationCheck. Lê `?trilha=` (Suspense).
- `components/trilha/station-check.tsx` — check formativo (predict-first / múltipla escolha) + feedback.
- `components/trilha/contrasting-cases.tsx` — 2 membros lado a lado (SHAP). **(#3)** *(Fatia 2)*
- `components/trilha/threshold-explorer.tsx` — slider de corte + leitura de recall/FP/ROI. **(#2)** *(Fatia 2)*
- `components/trilha/calibration-curve.tsx` — diagrama de confiabilidade + Brier. **(#4)** *(Fatia 2)*
- `components/trilha/executive-summary.tsx` — capstone imprimível. **(#6)** *(Fatia 3)*

**Novos — rotas (App Router, dentro de `(app)` p/ herdar shell + GuideRail):**
- `app/(app)/trilha/page.tsx` — capa (renderiza `<TrilhaMap>`).
- `app/(app)/trilha/avaliar/page.tsx` — estação Avaliar (threshold + calibração + ética). *(Fatia 2)*
- `app/(app)/trilha/sintese/page.tsx` — capstone. *(Fatia 3)*

**Alterados (contidos):**
- `components/app-shell.tsx` — adiciona item "Trilha de Aprendizado" ao `NAV` e monta
  `<GuideRail>` (dentro de `<Suspense>`) no shell. **Nenhuma** mudança nas telas reais (o overlay é
  dirigido pela URL).
- `lib/agent.ts` — `runCapstoneSummary(...)` + `fallbackCapstoneSummary(...)`. *(Fatia 3)*
- `docs/decisions/0015-trilha-overlay-progresso-local.md` + índice `decisions/README.md`.
- `README.md` / `docs/roteiro-demo.md` — citar a trilha como porta de entrada.

## 5. Contratos pinados (implementar exatamente)

```ts
// lib/trilha/missions.ts
export type MissionId = "entender" | "explicar" | "simular" | "decidir" | "avaliar" | "sintese";
export type BloomLevel = "Entender" | "Analisar" | "Aplicar" | "Avaliar" | "Criar";

export interface CheckOption { text: string; correct: boolean; feedback: string; }
export interface MissionCheck {
  /** Pergunta de recuperação / predict-first (1 por missão na v1). */
  prompt: string;
  options: CheckOption[];
}
export interface Mission {
  id: MissionId;
  order: number;            // 1..6
  bloom: BloomLevel;
  title: string;            // "Entender o problema"
  verb: string;             // microcopy do degrau ("Entender", "Explicar"…)
  href: string;             // "/dashboard?trilha=entender"
  deepenHref?: string;      // "/eda" (aprofundar opcional)
  objective: string;        // 1 frase: o que o aprendiz vai conseguir fazer
  instruction: string;      // o que fazer NESTA tela (guia; mais detalhado nas primeiras)
  tutorSeed: string;        // pergunta-semente p/ o tutor inline
  check: MissionCheck;
  estMin: number;           // estimativa de minutos (soma ≈ tour de ~10 min)
}
export const MISSIONS: Mission[];                 // 6 estações, em ordem
export function getMission(id: string): Mission | undefined;
export const TRILHA_TOTAL: number;                // MISSIONS.length
```

```ts
// components/trilha/use-trilha-progress.ts  — localStorage, key "vitaliza:trilha:v1"
export interface TrilhaProgress {
  completed: MissionId[];
  isComplete: (id: MissionId) => boolean;
  markComplete: (id: MissionId) => void;
  reset: () => void;
  pct: number;            // completed / TRILHA_TOTAL (0..100, inteiro)
  hydrated: boolean;      // false até ler o localStorage (evita flash)
}
export function useTrilhaProgress(): TrilhaProgress;
```

```ts
// lib/trilha/threshold.ts  (puro)
export interface Point { p: number; y: 0 | 1; }
export interface ThresholdCosts {
  retentionCost: number;   // custo de intervir num membro (FP + TP)
  churnLoss: number;       // perda quando um churn não é pego (FN)
  saveRate: number;        // fração de TP de fato retidos pela ação (0..1)
}
export interface ThresholdResult {
  cutoff: number;
  tp: number; fp: number; fn: number; tn: number;
  recall: number; precision: number; fpr: number;  // 0..1 (NaN→0 quando vazio)
  flagged: number;                                   // tp+fp (quantos a operação contataria)
  roi: number;                                       // benefício − custo (ver §7)
}
export function evaluateThreshold(points: Point[], cutoff: number, costs: ThresholdCosts): ThresholdResult;
export const DEFAULT_COSTS: ThresholdCosts;          // premissas explícitas, alinhadas ao RoiSimulator
```

```ts
// lib/trilha/calibration.ts  (puro)
import type { Point } from "./threshold";
export interface CalibrationBin {
  lo: number; hi: number; mid: number;   // faixa de probabilidade
  predicted: number;                     // média de p no bin
  observed: number;                      // fração de y=1 no bin (frequência real)
  count: number;
}
export function calibrationBins(points: Point[], nBins?: number): CalibrationBin[];  // default 10
export function brierScore(points: Point[]): number;   // média (p−y)^2
```

```ts
// app/api/trilha-data/route.ts
// GET → 200 { points: {p:number,y:0|1}[], baseRate:number, n:number, threshold:number }
// baseRate = média de y; threshold = corte do modelo (score.threshold) quando houver, senão 0.5.

// app/api/trilha-summary/route.ts
// POST { decisions?: string[] } → 200 { summary: string, source: "llm"|"fallback" }
```

```ts
// lib/agent.ts (aditivo)
export function runCapstoneSummary(input: CapstoneInput): Promise<string>;     // LLM
export function fallbackCapstoneSummary(input: CapstoneInput): string;         // determinístico
export interface CapstoneInput {
  baseRate: number; n: number;
  highlights: string[];   // o que o aprendiz percorreu (missões concluídas)
}
```

## 6. Experiência (UX), por missão

**Capa `/trilha`** (`TrilhaMap`): cabeçalho editorial (eyebrow + título serif), barra de progresso
(`ui/progress`), e a lista vertical das 6 estações como "degraus". Cada estação: número, verbo de
Bloom (eyebrow mono), título, objetivo, estado (✔ concluída / ● atual / ○ próxima), botões
**"Começar"/"Continuar"** (→ `href`) e **"Aprofundar"** quando houver. Topo: CTA **"Fazer o tour
guiado (~10 min)"** (vai à primeira missão não concluída). Rodapé: **"Reiniciar trilha"** (limpa o
progresso, com confirmação).

**GuideRail** (em qualquer tela com `?trilha=<id>`): painel **sticky no rodapé** (não cobre o
conteúdo; recolhível), com — eyebrow "Missão N/6 · {verbo}", título, **objetivo**, **instrução** do
que fazer ali, botão **"Pergunte ao tutor"** (semente = `mission.tutorSeed`, reusa `useTutor().open`),
e o CTA primário **"Concluir missão →"** que abre o StationCheck. Link discreto "sair da trilha"
(remove o param). Scaffolding decrescente: missões 1–2 mostram a `instruction` completa; 4–5 colapsam
por padrão.

**StationCheck** (modal/section disparado pelo GuideRail): mostra `mission.check.prompt`
(**predict-first**: "antes de ver, o que você acha?"), as opções; ao escolher, revela
**feedback** por opção (certo/erro + porquê) e o botão **"Concluir e voltar à trilha"** →
`markComplete(id)` → navega a `/trilha`. Sem punição (formativo): pode-se concluir mesmo errando,
mas o feedback ensina.

**Missão 2 — casos contrastantes (#3):** abaixo do SHAP, `ContrastingCases` mostra **2 membros**
(ex.: um crítico × um baixo) lado a lado com seus top drivers, destacando *por que o modelo os separa*.
Reusa `/api/explain/[id]`. *(Fatia 2)*

**Missão 3 — productive failure (#5):** o GuideRail pede "tente você primeiro: arraste para baixar
o risco antes de ver o otimizador". O Simulador Vivo já entrega o what-if/contrafactual.

**Missão 5 — Avaliar (`/trilha/avaliar`):** `ThresholdExplorer` (slider de corte + leitura de
recall/precisão/falsos positivos/ROI ao vivo, sobre os `(p,y)` reais) + `CalibrationCurve` (diagrama
de confiabilidade + Brier) + bloco de **ética da não-intrusão** (reafirma a regra do "cão que dorme").
Conecta o limiar à decisão de negócio. *(Fatia 2)*

**Capstone `/trilha/sintese`:** `ExecutiveSummary` chama `/api/trilha-summary` e renderiza um resumo
em prosa ("você desenhou uma estratégia de retenção: …"), com botão **"Imprimir / salvar PDF"**
(`window.print()`, usa `@media print` + `.no-print` já existentes). *(Fatia 3)*

## 7. Threshold + ROI — algoritmo (#2)

`evaluateThreshold`: para cada ponto, predito-positivo se `p >= cutoff`.
`tp` = predito-positivo & `y=1`; `fp` = predito-positivo & `y=0`; `fn`/`tn` análogos.
`recall = tp/(tp+fn)`, `precision = tp/(tp+fp)`, `fpr = fp/(fp+tn)` (cada um → 0 se denominador 0).
**ROI proxy** (premissas explícitas, alinhadas ao `RoiSimulator`):
`roi = tp*saveRate*churnLoss − (tp+fp)*retentionCost`. Mostrar as premissas na UI (nada caixa-preta).
Mover o corte revela o trade-off: corte baixo → recall alto, muitos FP (caro); corte alto → poupa
contatos, perde churns. O "ótimo" é o que **maximiza ROI**, não o que maximiza recall — esse é o insight.

## 8. Calibração (#4)

`calibrationBins`: particiona `[0,1]` em `nBins` faixas; por faixa, `predicted` = média de `p`,
`observed` = fração de `y=1`, `count`. Diagrama de confiabilidade: `observed` vs `predicted`
(diagonal = perfeito). `brierScore` = média `(p−y)²` (menor = melhor). Mensagem pedagógica:
"quando o modelo diz 70%, ~70% de fato cancelam?" — incerteza/confiança da predição.

## 9. Estilo (ADR-0010, sem marca)

Reusar **apenas** os tokens de `app/globals.css` (`--accent*`, `--ink*`, `--paper*`, `--steel*`,
`--rule`, `--tier-*`), utilitários `.eyebrow`/`.mono`, e os componentes `ui/*` (Card, Button, Badge,
Progress, Slider, Dialog/Sheet) + recharts com a paleta atual. Tipografia: serif display em títulos,
sans no corpo, mono nos eyebrows. **Zero** menção/nome/logo "allla". Sentence case. Acessibilidade:
foco visível, `aria-current`/`aria-expanded`/`aria-pressed`, alvos ≥ 40px, `prefers-reduced-motion`.

## 10. Edge cases / erros

- `useTrilhaProgress`: `try/catch` em torno do `localStorage` (modo privado/SSR); `hydrated=false`
  até o primeiro efeito; nunca quebra a renderização.
- `/api/trilha-data`: se `getScoredCustomers()` vazio → `{ points: [], baseRate: 0, n: 0, threshold: 0.5 }`;
  os exploradores mostram estado vazio ("popule a base"). Filtra pontos com `true_churn == null`.
- `threshold`/`calibration` com lista vazia → zeros/[], sem `NaN` vazando para a UI.
- `/api/trilha-summary`: sem `OPENROUTER_API_KEY` ou erro → `fallbackCapstoneSummary` (source
  `"fallback"`); nunca 500 por falta de chave.
- GuideRail: `?trilha=<id>` inválido → não renderiza nada (silencioso).
- `useSearchParams` exige `<Suspense>` (Next 16) — embrulhar o GuideRail.
- Turbopack serve CSS stale ao adicionar tokens — **não** vamos adicionar tokens novos (reuso puro);
  se necessário, `rm -rf .next`.

## 11. Testes (vitest)

- `threshold.test.ts`: matriz de confusão num conjunto pequeno conhecido; recall/precisão/fpr
  corretos; `cutoff=0` ⇒ recall 1; `cutoff>max` ⇒ tp=0; ROI = fórmula; lista vazia ⇒ zeros (sem NaN).
- `calibration.test.ts`: bins com contagem correta; `observed` bate numa distribuição montada;
  `brierScore` de previsão perfeita = 0; lista vazia ⇒ `[]`/0.
- `missions.test.ts`: 6 missões, `order` 1..6 único, todo `href` casa com `?trilha=<id>`, todo
  `check` tem ≥1 opção `correct`.

## 12. Fora de escopo (YAGNI)

Sem login/conta; sem gamificação pesada (pontos/badges/streaks); **capstone v1 = texto imprimível**
(sem geração de PDF server-side); sem persistência server-side do progresso; sem editar o XGBoost
real; sem A/B de copy; sem i18n (pt-BR apenas).

## 13. Plano de implementação (fatias — cada uma spec→plano→implementação→verificação)

**Fatia 1 — Espinha / tour** (núcleo navegável):
1. `lib/trilha/missions.ts` (+ `missions.test.ts`).
2. `components/trilha/use-trilha-progress.ts`.
3. `components/trilha/{trilha-map, guide-rail, station-check}.tsx`.
4. `app/(app)/trilha/page.tsx`; item no `NAV` + `<GuideRail>` (Suspense) no `app-shell.tsx`.
5. **Verificar:** `npm run lint` + `npm test` + `npm run build` verdes.

**Fatia 2 — Aprofundamentos** (#3, #2, #4):
1. `lib/trilha/threshold.ts` + `calibration.ts` (+ testes) — TDD.
2. `app/api/trilha-data/route.ts`.
3. `components/trilha/{contrasting-cases, threshold-explorer, calibration-curve}.tsx`.
4. `app/(app)/trilha/avaliar/page.tsx`; engatar `ContrastingCases` em Missão 2 (Individual).
5. **Verificar:** lint + test + build.

**Fatia 3 — Capstone** (#6):
1. `lib/agent.ts`: `runCapstoneSummary` + `fallbackCapstoneSummary`.
2. `app/api/trilha-summary/route.ts`.
3. `components/trilha/executive-summary.tsx`; `app/(app)/trilha/sintese/page.tsx`.
4. **Verificar:** lint + test + build.

**Fecho:** ADR-0015 + índice; README/roteiro-demo; commit com trailer `Agent: Claude Code`; push
(deploy Vercel); atualizar a memória de estado.
