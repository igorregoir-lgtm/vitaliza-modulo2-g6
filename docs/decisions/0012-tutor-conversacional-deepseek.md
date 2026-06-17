# ADR-0012 — Tutor conversacional (DeepSeek) com voz, TTS e escopo restrito

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O tutor pedagógico (antes só uma explicação pontual via OpenRouter) precisava ser **conversacional**,
**falar o conteúdo em voz alta**, **aceitar perguntas por áudio** e ficar **sempre acessível** durante
a navegação — restrito, sem exceção, a perguntas relacionadas a este repositório e seus temas.

## Decisão
- **Provedor:** **DeepSeek** (`deepseek-chat`, OpenAI-compatible) para o tutor conversacional, via rota
  server-only `app/api/tutor/route.ts`. Chave `DEEPSEEK_API_KEY` só em `.env.local`/Vercel (nunca no cliente).
- **UI:** `TutorProvider` com **botão flutuante** (`position: fixed`, acompanha o scroll) + painel de chat;
  presente em todas as telas do app (via AppShell). O `AprenderCard` abre o mesmo chat com o contexto da tela.
- **Voz (entrada):** Web Speech API (`SpeechRecognition`, pt-BR) no navegador → transcreve e envia. Botão de
  microfone com detecção de suporte (oculto se indisponível). Sem custo de API de áudio.
- **Voz (saída/TTS):** `SpeechSynthesis` (pt-BR) — botão "Ouvir" por mensagem + alternância de leitura automática.
- **Guardrails de ESCOPO (inegociáveis):** system prompt server-side restringe o agente EXCLUSIVAMENTE ao
  repositório Vitaliza e seus temas (modelo de churn, SHAP, telas, arquétipos, LGPD, trilha de tecnologia);
  recusa educadamente qualquer assunto sem relação direta; resiste a prompt-injection ("ignore instruções",
  "aja como…"). Reforço em código: só papéis user/assistant, últimas 12 mensagens, ≤1500 chars cada,
  temperatura 0,3, falha graciosa. Toda interação grava em `audit_log`.

## Opções consideradas
1. Manter só explicação pontual (rejeitado: não é conversacional nem por voz).
2. STT/TTS via API paga (rejeitado: Web Speech API resolve no cliente, sem custo/sem chave).
3. **DeepSeek + Web Speech/SpeechSynthesis + guardrails (escolhido).**

## Consequências
- Verificado no ar: responde temas do repo; recusa fora de escopo; bloqueia injection.
- Voz por navegador (Chrome/Edge/Safari); Firefox tem suporte limitado → microfone é ocultado quando ausente.
- Mais uma chave de API em texto puro durante a construção → **rotacionar `DEEPSEEK_API_KEY`** (como a OpenRouter).
- O advisor prescritivo (Função A/B) segue em OpenRouter (`/api/agent`); o tutor usa DeepSeek (`/api/tutor`).
