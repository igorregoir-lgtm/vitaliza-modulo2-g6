# ADR-0015 — Trilha de Aprendizado: overlay guiado sobre as telas reais + progresso local

- **Status:** Accepted · **Data:** 2026-06-19

## Contexto
O artefato é acadêmico e **não tem demo ao vivo**: o avaliador abre o sistema sozinho. As telas
(Dashboard, EDA, Consulta Individual, Simulador Vivo) já existem e funcionam, mas o aprendizado
depende de o usuário descobrir o caminho por conta própria. Queremos transformar o app de
"ferramenta com explicações" em **jornada pedagógica** (Bloom + construtivismo + retrieval practice +
productive failure) — ver `docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md` — sem
reescrever as telas nem introduzir login/servidor de estado.

## Decisão
A Trilha é um **overlay guiado dirigido pela URL**, não um conjunto de telas novas:

- **Guia sobre a tela real.** Cada missão abre a tela que já existe com `?trilha=<id>`. Um
  **GuideRail** montado uma única vez no `AppShell` aparece sempre que há `?trilha=<id>` na URL,
  sobrepondo objetivo + instrução + tutor + "Concluir missão" + check formativo. As telas reais
  **não mudam** (exceto a Consulta Individual, que ganha o módulo de casos contrastantes quando
  `?trilha=explicar`). Só as estações sem tela equivalente (Avaliar = sistema; Síntese = capstone)
  ganham rota própria sob `/trilha/*`.
- **Progresso em `sessionStorage`** (não `localStorage`), sem login nem servidor de estado
  (`use-trilha-progress` via `useSyncExternalStore`, SSR-safe). Chave `vitaliza:trilha:v1`.
  **Reset por visita:** como é um artefato avaliado por várias pessoas, cada visita deve começar
  limpa — o progresso zera ao fechar a aba/janela, mas sobrevive a um reload acidental no meio do
  tour. A capa mantém um botão **"Reiniciar trilha"** para zerar manualmente.
- **Fonte única de verdade** das 6 estações em `lib/trilha/missions.ts` — alimenta a capa, o
  GuideRail e o check.
- **Dados honestos.** As estações quantitativas usam os **escores REAIS** do modelo
  (`churn_probability` do XGBoost + `true_churn`), não a heurística: threshold (#2) e calibração (#4)
  são calculados client-side sobre os pares `(p, y)` servidos por `/api/trilha-data`. Linguagem
  consistente com o resto do sistema: descreve o comportamento do modelo, não causalidade.

## Opções consideradas
1. **Recriar cada etapa como telas novas dentro de `/trilha/*`** (rejeitado): duplicaria UI já
   existente (dashboard, SHAP, simulador), com risco de divergência e o dobro de manutenção.
2. **Progresso no servidor (Supabase) com conta/login** (rejeitado): contradiz o acesso aberto
   (sem login) e adiciona estado/persistência fora do escopo de um artefato acadêmico (YAGNI).
3. **Overlay dirigido pela URL + progresso local (escolhido):** reusa as telas reais como
   "laboratório", mantém uma única mecânica de guia/check/progresso, zero backend novo, e degrada
   graciosamente (sem `localStorage` o app continua navegável).

## Consequências
- Uma única mecânica (GuideRail param-driven) cobre missões em telas existentes e em rotas próprias.
- O progresso vive no navegador (sessionStorage): simples, sem login, **reset por visita** (ideal
  para avaliação por múltiplas pessoas); não sincroniza entre abas/dispositivos (aceitável; é
  material de aprendizado, não dado de produção).
- `useSearchParams` exige `<Suspense>` (Next 16) — o GuideRail é embrulhado no shell.
- Reuso de substrato: `getScoredCustomers()`/`getScoredCustomer()` para dados; `lib/agent.ts` para o
  capstone; tokens de `app/globals.css` (ADR-0010, **sem marca**). Nenhum token novo foi adicionado
  (evita o problema de CSS stale do Turbopack).
- Caminho de evolução: se um dia houver contas, o progresso pode migrar para o servidor sem mudar a
  mecânica de guia (o GuideRail só leria a fonte de progresso de outro lugar).
