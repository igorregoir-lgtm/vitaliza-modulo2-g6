# ADR-0013 — Voz humana pt-BR: TTS server-side (ElevenLabs + Google) com fallback

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O Tutor conversacional (LLM = DeepSeek) precisava de **voz humana em pt-BR**, com dois provedores
(ElevenLabs e Google Cloud TTS), fallback, e sem expor segredos no frontend. A stack é Next.js 16
(App Router, runtime Node) — há ambiente server-side apto para chamadas seguras.

## Decisão
- **DeepSeek permanece só como LLM** (geração de texto, `/api/tutor`). O TTS é uma camada separada.
- **Camada TTS modular** em `lib/tts/`: interface `TextToSpeechProvider`, providers
  `ElevenLabsTextToSpeechProvider` e `GoogleTextToSpeechProvider`, seletor+fallback (`index.ts`) e
  normalização de texto para fala (`speechify.ts`).
- **Endpoint server-side** `app/api/tts/route.ts` (Node runtime): `GET` = status (sem segredos),
  `POST` = síntese → `audio/mpeg`. Valida input, limita payload, timeout 15s, sem cache.
- **Google via REST** (compatível com serverless): autentica por `GOOGLE_TTS_API_KEY` **ou** por
  service account inline (`GOOGLE_APPLICATION_CREDENTIALS_JSON`) com JWT RS256 assinado via `crypto`
  (sem arquivo em disco — inviável no Vercel). ElevenLabs via REST com `xi-api-key`.
- **Fallback:** `TTS_PROVIDER` → `TTS_FALLBACK_PROVIDER` → demais; pula não-configurados e troca em
  erro; log explícito do provider usado.
- **Degradação graciosa:** sem credencial, `POST` responde 501 `tts_nao_configurado` (não silencioso)
  e o frontend usa a **voz do navegador** (Web Speech `SpeechSynthesis`, voz pt-BR mais natural).
- **Frontend:** `tutor-provider.tsx` consulta `GET /api/tts` no mount; ao "Ouvir", tenta o áudio do
  servidor (toca via `Audio`), com estados de loading/parar/erro; senão, voz do navegador. Rodapé
  mostra a fonte de voz ("voz natural (provider)" vs "voz do navegador").

## Opções consideradas
1. SDK `@google-cloud/text-to-speech` (rejeitado: gRPC + credencial em arquivo, ruim no serverless).
2. TTS só no navegador (rejeitado: qualidade robótica; não atende ao pedido de voz humana).
3. **REST + interface comum + fallback + degradação (escolhido).**

## Consequências
- Pronto para ativar: basta `ELEVENLABS_API_KEY` **ou** credencial Google + redeploy (sem mudar código).
- Mais segredos potenciais → todos server-side, nunca no bundle do cliente (verificado).
- Custo só quando credenciado; hoje opera em modo degradado (voz do navegador) sem custo.
- Instruções de obtenção das credenciais em `docs/voice-tts.md`.
