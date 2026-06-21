# Simulador Vivo + Otimizador de Alavanca (what-if narrado) — Design

> Spec de feature. Status: **aprovado** (brainstorming, 2026-06-17). Tela-alvo: Consulta Individual.
> Refina [ADR-0011](../../decisions/0011-inferencia-batch-vs-online.md) (simulador heurístico p/ what-if)
> e segue [ADR-0010](../../decisions/0010-paleta-sem-marca.md) (paleta allla **sem marca**).
> Registrar a decisão de ancoragem em **ADR-0014**.

## 1. Contexto e objetivo

O artefato é acadêmico e **não terá demo ao vivo**: o usuário abre o sistema sozinho e precisa
ter um momento 'aha' por **autodescoberta**, com forte **valor educacional**. A feature
transforma a Consulta Individual em um laboratório: o usuário arrasta alavancas acionáveis de um
membro e **vê o modelo mudar de ideia ao vivo** (score, waterfall SHAP, arquétipo), com o **tutor
narrando em voz** o que mudou e por quê, e um **otimizador** que aponta a alavanca mais barata para
baixar o risco — fechando o loop na intervenção que já existe.

Viabilidade-chave: `lib/heuristic.ts#predictHeuristic` é uma função **pura, transparente e
client-safe** → re-pontuação instantânea no navegador, sem rede e sem custo.

## 2. Decisão central — ancoragem honesta (→ ADR-0014)

O score exibido do membro vem do **XGBoost real** (Supabase). O simulador usa o **modelo
transparente** (heurística). Para ser honesto e defensável na banca:

```
projetado = clamp01( score_real_XGBoost + ( heuristica_modificada − heuristica_base ) )
```

O **delta** (efeito da intervenção) vem do modelo transparente; o **ponto de partida** é o score
real. Rótulos explícitos na UI ("Atual · XGBoost" / "Projeção · simulação") + nota de rodapé
("projeção pelo modelo transparente auditável; descreve comportamento do modelo, não causalidade").
Em modo amostra (sem score real), `score_real == heuristica_base`, então `projetado == heuristica_modificada`
— degrada de forma consistente.

## 3. Experiência (UX)

Ao selecionar um membro, abaixo do card de SHAP aparece **por padrão** (não atrás de toggle) o card
**"Simule uma intervenção"**:

1. **Leitor antes→depois**: dois números grandes — "Atual · XGBoost" e "Projeção · simulação" + delta em p.p.
2. **Alavancas** (a cada ajuste, debounce ~120 ms, re-score client-side; gauge + waterfall + badge de arquétipo do membro atualizam para a versão simulada).
3. **Otimizador**: banner com a alavanca mais barata p/ baixar um tier (ou banner de não-intrusão se sleeping_dog).
4. **Ações**: "Ouvir o que mudou" (voz on-demand), "Aplicar intervenção" (reusa `/api/apply-intervention`), "Resetar".

Discoverability (crítico para "abrir sozinho"): card visível por padrão; tease no `AprenderCard`
da tela; a saudação proativa do tutor nesta tela convida uma vez ("experimente arrastar uma alavanca").

## 4. Arquitetura — arquivos

**Novos (puros, isolados):**
- `lib/simulator/levers.ts` — metadados das alavancas (fonte única).
- `lib/simulator/engine.ts` — `projectAnchored()`, `findCheapestLever()`, `simulate()`.
- `lib/simulator/narrate.ts` — narração determinística.
- `lib/simulator/engine.test.ts`, `lib/simulator/narrate.test.ts` — vitest.

**Novos (client components):**
- `components/simulator/live-simulator.tsx` — orquestrador (estado dos overrides, debounce, reset, apply).
- `components/simulator/lever-controls.tsx` — sliders/toggle/select.
- `components/simulator/projection-readout.tsx` — antes→depois + delta + rodapé.
- `components/simulator/optimizer-hint.tsx` — banner do otimizador (+ não-intrusão).

**Novo (voz reutilizável):**
- `components/tutor/use-speak.ts` — hook extraído do `use-tutor-chat.ts`.

**Alterados (contidos):**
- `app/api/explain/[id]/route.ts` — passa a devolver `features` (tipo `ExplainResponse`).
- `lib/types.ts` — `ExplainResponse`.
- `components/individual-view.tsx` — consome `features`; renderiza `<LiveSimulator>` abaixo do SHAP.
- `components/tutor/use-tutor-chat.ts` — refatorado para consumir `useSpeak()` (sem mudar comportamento do tutor).
- `components/aprender-card.tsx` (uso na tela Individual em `app/(app)/individual/page.tsx`) — linha de tease.
- `docs/decisions/0014-*.md` + `README.md` — ADR da ancoragem.

## 5. Contratos pinados (implementar exatamente)

```ts
// lib/types.ts  (aditivo)
export interface ExplainResponse extends PredictResult {
  features: CustomerFeatures;
}
```

```ts
// lib/simulator/levers.ts
export type LeverControl = "slider" | "toggle" | "select";
export interface LeverDef {
  feature: keyof CustomerFeatures;   // Avg_class_frequency_current_month | Group_visits | Contract_period | Month_to_end_contract
  label: string;                     // pt-BR, sentence case
  control: LeverControl;
  min?: number; max?: number; step?: number;   // slider
  options?: number[];                          // select
  unit?: string;
  microcopy: string;                 // explicação educacional curta
  humanAction: (value: number) => string;  // frase de ação pronta p/ exibir/narrar
}
export const LEVERS: LeverDef[];     // 4 alavancas (ver §6)
```

```ts
// lib/simulator/engine.ts
import type { CustomerFeatures, PredictResult, RiskTier } from "@/lib/types";

export function simulate(base: CustomerFeatures, overrides: Partial<CustomerFeatures>): PredictResult;

export interface Projection {
  simBaseline: number;   // heurística sobre base
  simNew: number;        // heurística sobre {...base, ...overrides}
  projected: number;     // clamp01(realProb + simNew - simBaseline)
  deltaPP: number;       // Math.round((projected - realProb) * 100)
  predNew: PredictResult;// resultado completo da versão simulada (gauge/waterfall/arquétipo)
}
export function projectAnchored(
  base: CustomerFeatures, realProb: number, overrides: Partial<CustomerFeatures>,
): Projection;

export interface LeverSuggestion {
  feature: keyof CustomerFeatures;
  label: string;
  fromValue: number; toValue: number;
  humanAction: string;
  projected: number;
  fromTier: RiskTier; toTier: RiskTier;
}
// null quando: sleeping_dog/proactive_allowed=false, já 'baixo', ou nenhuma alavanca isolada baixa o tier no range.
export function findCheapestLever(base: CustomerFeatures, realProb: number): LeverSuggestion | null;
```

```ts
// lib/simulator/narrate.ts
export function buildNarration(args: {
  realProb: number; projected: number; deltaPP: number;
  changedLevers: { label: string; toValue: number; unit?: string }[];
  topDriverLabel: string; topDriverDir: "up" | "down";
}): string;   // frase pt-BR + disclaimer "comportamento do modelo, não causalidade"
```

```ts
// components/tutor/use-speak.ts
export interface SpeakApi {
  speak: (text: string) => void;
  stopSpeaking: () => void;
  playing: boolean;
  ttsLoading: boolean;
  voiceSourceLabel: string;
}
export function useSpeak(): SpeakApi;
```

```ts
// components/simulator/live-simulator.tsx
export function LiveSimulator(props: {
  externalRef: string;
  features: CustomerFeatures;
  realProb: number;          // pred.churn_probability
}): JSX.Element;
```

## 6. Alavancas (v1)

| feature | controle | range/opções | unidade | ação humana |
|---|---|---|---|---|
| `Avg_class_frequency_current_month` | slider | 0–5, step 0.1 | aulas/sem | "levar o membro a ~{v} aulas por semana" |
| `Group_visits` | toggle | 0/1 | — | "incluir o membro nos desafios em grupo" |
| `Contract_period` | select | 1,3,6,12 | meses | "renovar para um plano de {v} meses" |
| `Month_to_end_contract` | slider | 0–12, step 1 | meses | "trabalhar a renovação ({v} meses até o fim)" |

Frequência é a alavanca herói (maior peso). `deriveFeatures` recalcula `ratio`/flags ao editar a
frequência — é o que faz o **arquétipo virar** ao vivo. `Contract_period` e `Month_to_end_contract`
são editáveis de forma independente (simplificação aceitável do modelo transparente; anotar na UI).

## 7. Otimizador — algoritmo

`findCheapestLever`: tier atual = tier de `realProb` (via `tierFromProb`). Alvo = próximo tier abaixo.
Para cada alavanca em `LEVERS`, varrer o range (passo do `step`/opções) e achar a **menor** mudança
`|Δ valor|` cuja `projectAnchored(...).projected` cai para um tier estritamente menor. Escolher a de
**menor esforço normalizado** `|Δ| / (max−min)` (toggle/select: custo fixo por nível). Retornar `null`
se: `predictHeuristic(base)` for sleeping_dog ou `proactive_allowed===false`; tier já é `baixo`; ou
nenhuma alavanca cruza no range. Quando `null` por não-intrusão, a UI mostra o `SleepingDogBanner`
(padrão já existente em `individual-view.tsx`).

## 8. Voz — extração de `useSpeak()`

Mover do `use-tutor-chat.ts` para `components/tutor/use-speak.ts`: `pickPtVoice`, o efeito
`voiceschanged`, o efeito de disponibilidade `GET /api/tts` (`serverVoiceRef`/`voiceSourceLabel`),
`speak`/`speakBrowser`/`stopSpeaking` e os estados `playing`/`ttsLoading`. `useTutorChat` passa a
**consumir** `useSpeak()` (sem alterar comportamento observável do tutor; `speakOn` continua chamando
`speak()`). O simulador usa `useSpeak()` no botão "Ouvir o que mudou" com a string de `buildNarration`.

## 9. Estilo (ADR-0010, sem marca)

Reusar **apenas** os tokens de `app/globals.css`: `--accent`/`--accent-deep`/`--accent-light`,
`--ink`/`--ink-soft`, `--paper`/`--paper-soft`, `--steel`/`--steel-soft`, `--rule`, tiers
`--tier-{baixo,medio,alto,critico}`; utilitários `.eyebrow`/`.mono`; componentes `ui/*` (Card,
Slider, Select, Button, Badge) e o visual da `individual-view.tsx`. **Nenhuma** menção/logo/cor de
marca allla. Sentence case. Acessibilidade: labels nos sliders, `aria-pressed` no toggle, foco visível.

## 10. Edge cases / erros

- `clamp01` em toda probabilidade; ranges validados; números arredondados na UI (p.p. inteiro, prob em %).
- Debounce ~120 ms no re-score; "Resetar" volta aos valores originais do membro.
- TTS indisponível → cai na voz do navegador (comportamento atual do `useSpeak`).
- Otimizador sem solução no range → texto "nenhuma alavanca isolada baixa o tier".
- `apply-intervention` já bloqueia sleeping_dog (status `bloqueada`); o simulador respeita.
- Modo amostra (sem Supabase): tudo funciona com `realProb == heuristica_base`.

## 11. Testes (vitest, padrão `lib/tts/*.test.ts`)

`engine.test.ts`: ancoragem (`projected == clamp(real + simNew − simBaseline)`); monotonicidade
(↑frequência ⇒ ↓prob); `findCheapestLever` acha alavanca válida num caso crítico; retorna `null` em
sleeping_dog e em tier `baixo`; clamp nos limites. `narrate.test.ts`: a frase cita o maior driver,
a direção certa e contém o disclaimer.

## 12. Fora de escopo (YAGNI)

Sem otimização multi-alavanca; sem persistir simulações; sem narração via LLM (apenas determinística);
sem editar features não-acionáveis (idade/gênero/etc.); **sem tocar no XGBoost real**.

## 13. Plano de implementação (fases — espelhadas no workflow)

1. **Núcleo puro (TDD):** `levers.ts`, `engine.ts`, `narrate.ts` + testes; `npm test` verde.
2. **Voz:** extrair `use-speak.ts`; refatorar `use-tutor-chat.ts` (sem regressão).  *(paralelo à fase 1)*
3. **Componentes:** `live-simulator.tsx` + `lever-controls`/`projection-readout`/`optimizer-hint`.
4. **Integração:** `ExplainResponse` (`lib/types.ts` + rota `explain`); `individual-view.tsx`;
   tease no `AprenderCard`; **ADR-0014** + índice `decisions/README.md`.
5. **Verificação:** `npm run build` + `npm run lint` + `npm test` verdes; correções.
