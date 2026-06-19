# Decision Log (ADRs) — Vitaliza

Registro auditável de decisões de arquitetura. Cada ADR: contexto, decisão, opções consideradas e
consequências. Convenção allla (ver `AGENTS.md` na raiz do produto).

| ADR | Decisão | Status |
|-----|---------|--------|
| [0001](0001-stack-vercel-supabase-nextjs.md) | Stack Vercel + Supabase + Next.js (substitui Render/FastAPI/Streamlit) | Accepted |
| [0002](0002-fork-referencia.md) | Fork de `allexfernand/Modulo2-G6` como ponto de partida (inspiração não-limitante) | Accepted |
| [0003](0003-dataset-fornecido.md) | Dataset = CSV fornecido (gym_churn, 4000×14) | Accepted |
| [0004](0004-notebook-marimo.md) | Notebook em Marimo + export para `01_eda_vitaliza.ipynb` | Accepted |
| [0005](0005-inferencia-vercel-python-joblib.md) | Inferência em Vercel Python Functions com `joblib` | Accepted |
| [0006](0006-explicabilidade-shap-llm.md) | Explicabilidade SHAP (global+local) + NL via LLM | Accepted |
| [0007](0007-openrouter-segredo.md) | OpenRouter via env/server-side; chave como segredo | Accepted |
| [0008](0008-arquetipos-sleeping-dog.md) | 5 arquétipos + exclusão proativa de sleeping_dogs | Accepted |
| [0009](0009-auditabilidade.md) | Auditabilidade: decision log + audit_log + model card | Accepted |
| [0010](0010-paleta-sem-marca.md) | Paleta allla sem qualquer menção à marca | Accepted |
| [0011](0011-inferencia-batch-vs-online.md) | Inferência em lote (real) + simulador heurístico p/ what-if | Accepted |
| [0012](0012-tutor-conversacional-deepseek.md) | Tutor conversacional (DeepSeek) com voz, TTS e escopo restrito | Accepted |
| [0013](0013-tts-elevenlabs-google.md) | Voz humana pt-BR: TTS server-side (ElevenLabs + Google) com fallback | Accepted |
| [0014](0014-ancoragem-simulador-real-mais-delta.md) | Ancoragem do simulador: score real (XGBoost) + delta heurístico (refina 0011) | Accepted |
| [0015](0015-trilha-overlay-progresso-local.md) | Trilha de Aprendizado: overlay guiado sobre as telas reais + progresso local (localStorage) | Accepted |

> Decisões de produto confirmadas pelo cliente em 2026-06-17: build autônomo até o ar; fork em
> `igorregoir-lgtm/Modulo2-G6` (mantendo o nome); novos projetos Supabase + Vercel; frontend
> Next.js + Tailwind + shadcn; notebook em Marimo; dataset = CSV anexado; artefato **auditável**.
