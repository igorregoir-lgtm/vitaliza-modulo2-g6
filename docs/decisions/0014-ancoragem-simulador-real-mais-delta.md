# ADR-0014 — Ancoragem do simulador: score real (XGBoost) + delta heurístico

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O Simulador Vivo (ver `docs/superpowers/specs/2026-06-17-simulador-vivo-design.md`) transforma a
Consulta Individual num laboratório what-if: o usuário arrasta alavancas acionáveis e vê o modelo
"mudar de ideia ao vivo". Para re-pontuar instantaneamente no navegador, sem rede e sem custo, a
re-pontuação usa o **modelo transparente** (`lib/heuristic.ts#predictHeuristic`), que é puro e
client-safe — o XGBoost real vive em lote no Supabase (ADR-0011) e não roda na borda.

Surge uma tensão de honestidade: o número exibido como score "Atual" do membro é o **XGBoost real**,
mas o re-cálculo do what-if vem da **heurística**. Mostrar o resultado bruto da heurística como
"novo score" criaria um salto incoerente no momento em que o usuário começa a simular (o ponto de
partida da heurística raramente coincide com o score real), enfraquecendo a defesa na banca.

## Decisão
A projeção exibida **ancora no score real e aplica apenas o delta da heurística**:

```
projetado = clamp01( score_real_XGBoost + ( heuristica_modificada − heuristica_base ) )
```

- O **ponto de partida** ("Atual · XGBoost") é o score real do membro.
- O **delta** (efeito da intervenção) vem do modelo transparente: `heuristica_modificada − heuristica_base`,
  ambos calculados sobre o mesmo cliente (com e sem os overrides das alavancas).
- A UI rotula explicitamente os dois números ("Atual · XGBoost" / "Projeção · simulação") e exibe a
  nota de rodapé: projeção pelo modelo transparente auditável; **descreve o comportamento do modelo,
  não causalidade**.
- Em **modo amostra** (sem score real no Supabase), `score_real == heuristica_base`, logo
  `projetado == heuristica_modificada` — degrada de forma consistente, sem caso especial.

Isto **refina a ADR-0011**: aquela decidiu *quem* serve cada inferência (lote real servido vs.
simulador heurístico para what-if); esta fixa *como* combinar os dois honestamente num único leitor
antes→depois.

## Opções consideradas
1. **Exibir a heurística crua como novo score** (rejeitado): salto incoerente vs. o score real no
   primeiro ajuste; mistura dois modelos sem rótulo; difícil de defender.
2. **Rodar o XGBoost real on-the-fly para cada ajuste** (rejeitado nesta entrega): exige o runtime
   Python pesado na borda — o problema que a ADR-0011 já evitou; mataria a re-pontuação instantânea.
3. **Ancorar no real e somar só o delta heurístico (escolhido):** mantém o número de partida fiel ao
   modelo de produção, usa a heurística apenas para o *efeito relativo* da intervenção (que é o que o
   what-if precisa), e degrada de forma limpa no modo amostra.

## Consequências
- O leitor antes→depois é coerente: "Atual" é sempre o XGBoost real; a "Projeção" parte dele.
- A heurística é usada só para o **delta** — o que ela faz bem (direção/ordem de grandeza do efeito),
  não para reproduzir o nível absoluto do XGBoost.
- Honestidade auditável: rótulos por modelo + disclaimer de "comportamento do modelo, não causalidade";
  nenhuma feature não-acionável é editável e o XGBoost real não é tocado (ver §12 do spec).
- `clamp01` garante probabilidade válida nos extremos; o delta em p.p. é arredondado para inteiro na UI.
- Caminho de evolução: se o `pipeline/inference.py` for exposto online (ONNX/container, ADR-0011), a
  ancoragem some — a projeção passaria a ser o próprio modelo real re-executado, sem mudar a UI.
