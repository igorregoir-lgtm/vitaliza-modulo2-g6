// ============================================================================
// Seletor / fallback de provider TTS + status de configuração.
// Ordem: TTS_PROVIDER (principal) -> TTS_FALLBACK_PROVIDER -> o restante.
// Fallback automático se o principal não estiver configurado OU falhar.
// ============================================================================

import type { TextToSpeechProvider, TtsAudio, TtsProviderName } from "./types";
import { ElevenLabsTextToSpeechProvider } from "./providers/elevenlabs";
import { GoogleTextToSpeechProvider } from "./providers/google";
import { normalizeForSpeech } from "./speechify";

export const TTS_TEXT_LIMIT = 1500;
const ALL: TtsProviderName[] = ["elevenlabs", "google"];

function build(name: TtsProviderName): TextToSpeechProvider {
  return name === "google"
    ? new GoogleTextToSpeechProvider()
    : new ElevenLabsTextToSpeechProvider();
}

function asName(v: string | undefined, fallback: TtsProviderName): TtsProviderName {
  const n = (v ?? "").toLowerCase();
  return n === "elevenlabs" || n === "google" ? n : fallback;
}

export function ttsEnabled(): boolean {
  return (process.env.TTS_ENABLED ?? "true").toLowerCase() !== "false";
}

export function audioAutoplay(): boolean {
  return (process.env.AUDIO_AUTOPLAY ?? "true").toLowerCase() !== "false";
}

/** Ordem de tentativa dos providers (principal, fallback, demais). */
export function providerOrder(): TtsProviderName[] {
  const primary = asName(process.env.TTS_PROVIDER, "elevenlabs");
  const fallback = asName(process.env.TTS_FALLBACK_PROVIDER, "google");
  const order: TtsProviderName[] = [];
  for (const n of [primary, fallback, ...ALL]) if (!order.includes(n)) order.push(n);
  return order;
}

export interface TtsStatus {
  enabled: boolean;
  autoplay: boolean;
  primary: TtsProviderName;
  fallback: TtsProviderName;
  providers: { name: TtsProviderName; configured: boolean; description: string }[];
  anyConfigured: boolean;
  /** se false, o frontend deve usar a voz do navegador (modo degradado). */
  serverVoiceAvailable: boolean;
}

export function getTtsStatus(): TtsStatus {
  const providers = ALL.map((name) => {
    const p = build(name);
    return { name, configured: p.isConfigured(), description: p.describe() };
  });
  const anyConfigured = providers.some((p) => p.configured);
  return {
    enabled: ttsEnabled(),
    autoplay: audioAutoplay(),
    primary: asName(process.env.TTS_PROVIDER, "elevenlabs"),
    fallback: asName(process.env.TTS_FALLBACK_PROVIDER, "google"),
    providers,
    anyConfigured,
    serverVoiceAvailable: ttsEnabled() && anyConfigured,
  };
}

export interface SynthesisOutcome {
  ok: boolean;
  audio?: TtsAudio;
  /** motivo quando ok=false: desativado | nao_configurado | falha_provedores */
  reason?: "desativado" | "nao_configurado" | "falha_provedores";
  attempts: { provider: TtsProviderName; ok: boolean; detail: string }[];
}

/** Sintetiza fala com seleção + fallback. Nunca lança: retorna outcome. */
export async function synthesizeSpeech(
  rawText: string,
  signal?: AbortSignal,
): Promise<SynthesisOutcome> {
  const attempts: SynthesisOutcome["attempts"] = [];
  if (!ttsEnabled()) {
    console.warn("[tts] TTS_ENABLED=false — síntese desativada.");
    return { ok: false, reason: "desativado", attempts };
  }
  const text = normalizeForSpeech(rawText).slice(0, TTS_TEXT_LIMIT);
  if (!text) return { ok: false, reason: "falha_provedores", attempts };

  let anyConfigured = false;
  for (const name of providerOrder()) {
    const provider = build(name);
    if (!provider.isConfigured()) {
      attempts.push({ provider: name, ok: false, detail: "não configurado" });
      continue;
    }
    anyConfigured = true;
    try {
      const audio = await provider.synthesize(text, signal);
      attempts.push({ provider: name, ok: true, detail: "ok" });
      console.info(`[tts] síntese OK via "${name}".`);
      return { ok: true, audio, attempts };
    } catch (e) {
      const detail = (e as Error).message;
      attempts.push({ provider: name, ok: false, detail });
      console.error(`[tts] provider "${name}" falhou: ${detail}`);
    }
  }

  if (!anyConfigured) {
    console.warn("[tts] nenhum provider de voz configurado — usando voz do navegador no cliente.");
    return { ok: false, reason: "nao_configurado", attempts };
  }
  console.warn("[tts] todos os providers falharam.");
  return { ok: false, reason: "falha_provedores", attempts };
}
