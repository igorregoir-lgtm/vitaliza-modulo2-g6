import type { TextToSpeechProvider, TtsAudio } from "../types";
import { TtsNotConfiguredError } from "../types";

// Voz multilíngue padrão (suporta pt-BR via eleven_multilingual_v2).
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // "Sarah" (multilingual)
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export class ElevenLabsTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = "elevenlabs" as const;
  private readonly apiKey = (process.env.ELEVENLABS_API_KEY ?? "").trim();
  private readonly voiceId = (process.env.ELEVENLABS_VOICE_ID ?? "").trim() || DEFAULT_VOICE_ID;
  private readonly modelId = (process.env.ELEVENLABS_MODEL_ID ?? "").trim() || DEFAULT_MODEL_ID;

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  describe(): string {
    return this.isConfigured()
      ? `ElevenLabs (voice=${this.voiceId}, model=${this.modelId})`
      : "ElevenLabs (ausente: ELEVENLABS_API_KEY)";
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<TtsAudio> {
    if (!this.isConfigured()) throw new TtsNotConfiguredError(this.name);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}`;
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: this.modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`ElevenLabs HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const audio = await res.arrayBuffer();
    if (audio.byteLength === 0) throw new Error("ElevenLabs retornou áudio vazio");
    return { audio, contentType: "audio/mpeg", provider: this.name };
  }
}
