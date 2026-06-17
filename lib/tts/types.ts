// ============================================================================
// Camada TTS — interface comum (server-side). DeepSeek (LLM) NÃO faz parte
// daqui: esta camada apenas sintetiza fala a partir de texto.
// ============================================================================

export type TtsProviderName = "elevenlabs" | "google";

export interface TtsAudio {
  audio: ArrayBuffer;
  contentType: string; // ex.: "audio/mpeg"
  provider: TtsProviderName;
}

/** Interface comum para todo provedor de Text-to-Speech. */
export interface TextToSpeechProvider {
  readonly name: TtsProviderName;
  /** true se as credenciais/config necessárias estão presentes no servidor. */
  isConfigured(): boolean;
  /** descrição curta da config (SEM segredos) para status/diagnóstico. */
  describe(): string;
  /** sintetiza `text` (já normalizado) em áudio; lança erro em falha. */
  synthesize(text: string, signal?: AbortSignal): Promise<TtsAudio>;
}

export class TtsNotConfiguredError extends Error {
  constructor(public providerName: TtsProviderName) {
    super(`Provedor de TTS "${providerName}" não está configurado.`);
    this.name = "TtsNotConfiguredError";
  }
}
