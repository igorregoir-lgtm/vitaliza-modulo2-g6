# Runbook Operacional — Vitaliza

## Ambientes
- **Produção (web):** Vercel · projeto `vitaliza-retencao` · https://vitaliza-retencao.vercel.app · região `gru1`.
- **Dados/Auth:** Supabase · projeto `vitaliza-retencao` (ref `qjcypxuyqdvpozyrkbzg`, São Paulo).
- **Repo:** https://github.com/igorregoir-lgtm/Modulo2-G6 (deploy conectado ao `main`).

## Variáveis de ambiente (secrets)
Definidas em `.env.local` (dev, git-ignored) e nas Environment Variables da Vercel (produção):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL` (=`anthropic/claude-sonnet-4.6`),
`DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`.
**Voz (TTS):** `TTS_ENABLED`, `TTS_PROVIDER`, `TTS_FALLBACK_PROVIDER`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `GOOGLE_TTS_API_KEY` ou
`GOOGLE_APPLICATION_CREDENTIALS_JSON`, `GOOGLE_TTS_LANGUAGE_CODE`, `GOOGLE_TTS_VOICE_NAME`,
`AUDIO_AUTOPLAY` — detalhes e obtenção de credenciais em [`docs/voice-tts.md`](voice-tts.md).
Nunca commitar segredos.

## Deploy
```bash
# CLI (a partir da raiz do app)
vercel --prod --yes
# ou via git push origin main (deploy automático conectado)
```
Atualizar uma env var de produção:
```bash
vercel env rm NOME production -y; printf 'valor' | vercel env add NOME production; vercel --prod --yes
```

## Banco de dados
```bash
supabase link --project-ref qjcypxuyqdvpozyrkbzg -p "$SUPABASE_DB_PASSWORD"
supabase db push                 # aplica migrations de supabase/migrations/
```

## Retreino + repontuação (pipeline ML, offline)
```bash
.venv/Scripts/python -m pipeline.train_final    # treina, valida, serializa model.joblib + metrics.json
.venv/Scripts/python -m pipeline.seed_supabase  # repontua os 4.000 clientes -> tabelas customer/score
.venv/Scripts/python -m pipeline.seed_phase2    # SHAP por cliente -> explanation + lib/eda-data.json
# commit lib/eda-data.json e (se mudou) pipeline/artifacts/*, depois redeploy
```

## Gestão de usuários (demo / perfis)
```bash
# criar usuário (service role)
curl -X POST "$URL/auth/v1/admin/users" -H "apikey: $SRV" -H "Authorization: Bearer $SRV" \
  -H "Content-Type: application/json" -d '{"email":"x@y.z","password":"...","email_confirm":true}'
# definir papel: profiles.role in ('cs','exec','admin')
curl -X PATCH "$URL/rest/v1/profiles?email=eq.x@y.z" -H "apikey: $SRV" -H "Authorization: Bearer $SRV" \
  -H "Content-Type: application/json" -d '{"role":"exec"}'
```

## Troubleshooting
| Sintoma | Causa provável | Ação |
|---|---|---|
| Build Vercel `module not found @/lib/...` | `.vercelignore` com padrão não-ancorado (ex.: `supabase/` pega `lib/supabase/`) | ancorar com `/` (ver `.vercelignore`) |
| Agente responde "degraded / verifique a chave" | header não-ASCII no fetch (ByteString) **ou** modelo/again inválido | `X-Title` deve ser ASCII; `OPENROUTER_MODEL` válido (`/models`); ver logs `vercel logs <url> --json` |
| Telas sem dados | Supabase vazio | rodar `seed_supabase` + `seed_phase2` |
| Login falha | usuário sem `email_confirm` | recriar com `email_confirm:true` |

## Auditoria
- Decisões: `docs/decisions/` (ADRs). Rastreabilidade: `docs/traceability-matrix.md`. Modelo: `docs/model_card.md`.
- Toda previsão/ação grava em `audit_log` (Supabase) com input anonimizado, score, threshold, model_version, ator, timestamp.
