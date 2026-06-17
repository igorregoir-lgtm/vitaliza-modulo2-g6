import { getTtsStatus, synthesizeSpeech } from "@/lib/tts";

// Node.js runtime: necessário p/ crypto (JWT do Google) e Buffer.
export const runtime = "nodejs";

const MAX_INPUT = 8000; // limite de payload (anti-abuso); a síntese ainda corta em TTS_TEXT_LIMIT

/** GET /api/tts -> status de configuração (sem segredos). */
export async function GET() {
  return Response.json(getTtsStatus(), { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/tts { text } -> áudio (audio/mpeg) ou JSON de status quando indisponível. */
export async function POST(req: Request) {
  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text : "";
  } catch {
    return Response.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!text.trim()) return Response.json({ error: "texto_ausente" }, { status: 400 });
  if (text.length > MAX_INPUT) return Response.json({ error: "texto_muito_longo" }, { status: 413 });

  const status = getTtsStatus();
  if (!status.enabled) {
    return Response.json({ error: "tts_desativado", serverVoiceAvailable: false }, { status: 503 });
  }
  if (!status.anyConfigured) {
    // Não é falha silenciosa: 501 + flag para o cliente cair na voz do navegador.
    return Response.json(
      {
        error: "tts_nao_configurado",
        serverVoiceAvailable: false,
        message:
          "Nenhum provedor de voz (ElevenLabs/Google) configurado. Usando a voz do navegador.",
      },
      { status: 501 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const outcome = await synthesizeSpeech(text, controller.signal);
    if (outcome.ok && outcome.audio) {
      return new Response(outcome.audio.audio, {
        status: 200,
        headers: {
          "Content-Type": outcome.audio.contentType,
          "X-TTS-Provider": outcome.audio.provider,
          "Cache-Control": "no-store",
        },
      });
    }
    const code = outcome.reason === "nao_configurado" ? 501 : 502;
    return Response.json(
      { error: outcome.reason ?? "falha_provedores", serverVoiceAvailable: false, attempts: outcome.attempts },
      { status: code },
    );
  } catch (e) {
    console.error("[tts] erro inesperado:", (e as Error).message);
    return Response.json({ error: "erro_interno", serverVoiceAvailable: false }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}
