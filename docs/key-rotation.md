# Checklist de rotação de chaves (ação do usuário)

> Durante a construção, várias chaves trafegaram em texto puro no chat. **Recomenda-se rotacioná-las.**
> Só **você** pode gerar as novas nos provedores; depois eu re-plugo na Vercel + `.env.local` em ~1 min.
> **Nunca** commitar valores — só `.env.local` (git-ignored) e as env vars da Vercel.

## Por chave — onde gerar e onde re-plugar

| Variável (`.env.local` + Vercel) | Provedor — onde rotacionar |
|---|---|
| `OPENROUTER_API_KEY` | openrouter.ai → Keys → revogar a antiga, criar nova |
| `DEEPSEEK_API_KEY` | platform.deepseek.com → API Keys → revogar/criar |
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API Key → regenerar (manter permissão `text_to_speech`) |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Google Cloud → IAM → Service Accounts (`vitaliza-tts@…`) → Keys → criar nova chave JSON, apagar a antiga |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **Reset** service_role (cuidado: invalida sessões/admin) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → rotacionar anon (se desejado; é pública por design) |
| `SUPABASE_DB_PASSWORD` | Supabase → Database → reset da senha do Postgres |

> `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`,
> `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `TTS_PROVIDER`, `TTS_FALLBACK_PROVIDER` **não
> são segredos** — não precisam rotação.

## Passos
1. Para cada linha acima: gere a nova credencial e **revogue a antiga** no provedor.
2. Me passe os novos valores (ou cole você mesmo): atualizo `Artefato/.env.local` e as **Environment
   Variables** do projeto na Vercel (Production).
3. `git push` vazio/redeploy para a Vercel recarregar as envs, ou redeploy pelo dashboard.
4. Smoke test: `/api/tts` (status dos provedores), `/api/tutor` e `/api/recommend` respondendo;
   `/api/trilha-data` 200.

## Verificação rápida (sem expor valores)
```bash
# nomes presentes no .env.local (sem valores)
grep -oE '^[A-Z0-9_]+=' Artefato/.env.local | sed 's/=$//' | sort
# confirmar que nada vazou no bundle do cliente (não deve achar service_role/secret)
grep -rE 'SUPABASE_SERVICE_ROLE|OPENROUTER_API_KEY|DEEPSEEK_API_KEY' Artefato/.next/static 2>/dev/null && echo "VAZOU" || echo "ok: nada no bundle"
```
