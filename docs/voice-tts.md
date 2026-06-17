# Voz (Text-to-Speech) — ElevenLabs + Google Cloud TTS

Camada de **voz humana em pt-BR** para o Tutor conversacional. O **DeepSeek continua
sendo o LLM** (apenas geração de texto). O TTS é **server-side**, com **fallback automático**
entre provedores e **degradação graciosa** para a voz do navegador quando não há credencial.

## Como funciona
1. O Tutor (DeepSeek) gera a resposta em texto — fluxo inalterado (`/api/tutor`).
2. Ao clicar em **Ouvir** (ou na saudação/auto-leitura), o frontend chama **`POST /api/tts`**.
3. O servidor **normaliza o texto para fala** (remove markdown/URLs, trata `%`, `R$`, siglas,
   pontuação/prosódia — `lib/tts/speechify.ts`), escolhe o provedor (`TTS_PROVIDER`), e em caso
   de falha tenta o `TTS_FALLBACK_PROVIDER`.
4. Retorna **áudio `audio/mpeg`** (cabeçalho `X-TTS-Provider` indica quem sintetizou).
5. Se **nenhum provedor estiver configurado** (501) ou o TTS estiver desligado (503), o frontend
   **cai na voz do navegador** (Web Speech `SpeechSynthesis`, com seleção da voz pt-BR mais natural).

Arquitetura: `lib/tts/types.ts` (interface `TextToSpeechProvider`), `providers/elevenlabs.ts`,
`providers/google.ts`, `index.ts` (seletor + fallback + status), `app/api/tts/route.ts`
(GET status / POST síntese). Decisão: `docs/decisions/0013-tts-elevenlabs-google.md`.

## Variáveis de ambiente
| Var | Obrigatória | Default | Descrição |
|-----|-------------|---------|-----------|
| `TTS_ENABLED` | não | `true` | liga/desliga o TTS server-side |
| `AUDIO_AUTOPLAY` | não | `true` | permite leitura automática (a saudação só fala após clique) |
| `TTS_PROVIDER` | não | `elevenlabs` | provedor principal (`elevenlabs`/`google`) |
| `TTS_FALLBACK_PROVIDER` | não | `google` | fallback automático |
| `ELEVENLABS_API_KEY` | p/ ElevenLabs | — | **segredo**; ativa o ElevenLabs |
| `ELEVENLABS_VOICE_ID` | não | `EXAVITQu4vr4xnSDxMaL` | voz (multilíngue) |
| `ELEVENLABS_MODEL_ID` | não | `eleven_multilingual_v2` | modelo (suporta pt-BR) |
| `GOOGLE_TTS_API_KEY` | p/ Google (opção 1) | — | **segredo**; chave de API |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | p/ Google (opção 2) | — | **segredo**; JSON da service account (inline) |
| `GOOGLE_TTS_LANGUAGE_CODE` | não | `pt-BR` | idioma |
| `GOOGLE_TTS_VOICE_NAME` | não | `pt-BR-Neural2-C` | voz neural pt-BR |

> Segredos vivem só em `.env.local` (dev, git-ignored) e nas Environment Variables da Vercel.
> **Nunca** são expostos ao frontend (verificável: ausentes em `.next/static`).

---

## Obter a credencial do ElevenLabs
1. Crie/entre na conta em **https://elevenlabs.io**.
2. No canto superior direito, abra o menu do perfil → **Settings**.
3. Vá em **API Keys** → **Create API Key** (ou "Generate") e **copie** a chave.
4. Defina no projeto: `ELEVENLABS_API_KEY=<sua_chave>`.
5. (Opcional) Escolha uma voz em **Voices** e copie o **Voice ID** para `ELEVENLABS_VOICE_ID`.
   Mantenha `ELEVENLABS_MODEL_ID=eleven_multilingual_v2` para boa pronúncia em pt-BR.
- Local: adicione em `.env.local`. Produção: **Vercel → Project → Settings → Environment Variables**.

## Habilitar e configurar o Google Cloud Text-to-Speech
1. Acesse o **Google Cloud Console** (https://console.cloud.google.com) e **crie/selecione um projeto**.
2. Ative a API: **APIs & Services → Library →** procure **"Cloud Text-to-Speech API" → Enable**.
3. Escolha **uma** forma de autenticação:
   - **Opção 1 — Chave de API (mais simples no Vercel):** APIs & Services → **Credentials** →
     **Create credentials → API key**. Copie e defina `GOOGLE_TTS_API_KEY=<chave>`.
     (Recomenda-se restringir a key à "Cloud Text-to-Speech API".)
   - **Opção 2 — Service Account (JSON):** IAM & Admin → **Service Accounts** → crie uma conta →
     **Keys → Add key → JSON** (baixa um arquivo). Como o deploy é serverless (Vercel, sem disco
     persistente), **cole o conteúdo do JSON** em `GOOGLE_APPLICATION_CREDENTIALS_JSON`
     (uma env var única). O servidor gera o token OAuth2 automaticamente.
     *(Em ambientes com filesystem, o padrão `GOOGLE_APPLICATION_CREDENTIALS=/caminho/para.json`
     também é comum; aqui usamos o JSON inline por causa do serverless.)*
4. (Opcional) Ajuste `GOOGLE_TTS_VOICE_NAME` (ex.: `pt-BR-Neural2-B` masculino, `pt-BR-Wavenet-A`).

---

## Testar
```bash
# status (quais provedores estão configurados)
curl -s http://localhost:3000/api/tts | jq

# síntese (salva um mp3 se houver provedor configurado; senão retorna JSON 501)
curl -s -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Olá! Esta é a voz do tutor do Vitaliza."}' --output tutor.mp3
```
Testes unitários da normalização e do seletor/fallback: `npm test`.

## Comportamento sem credencial (estado atual)
- `GET /api/tts` → `serverVoiceAvailable: false`, `anyConfigured: false`.
- `POST /api/tts` → **501 `tts_nao_configurado`** (não é falha silenciosa).
- Frontend → usa a **voz do navegador** e mostra "voz do navegador" no rodapé do chat.
- Para ativar a voz natural, basta definir `ELEVENLABS_API_KEY` **ou** as credenciais do Google e
  redeployar — nenhuma mudança de código é necessária.
