import crypto from "node:crypto";
import type { TextToSpeechProvider, TtsAudio } from "../types";
import { TtsNotConfiguredError } from "../types";

// Google Cloud Text-to-Speech via REST (compatível com Vercel/serverless).
// Autenticação suportada (em ordem de preferência):
//   1) GOOGLE_TTS_API_KEY            -> chave de API (mais simples no Vercel)
//   2) GOOGLE_APPLICATION_CREDENTIALS_JSON -> JSON da service account (inline)
//      (mintamos um access token OAuth2 via JWT — sem arquivo em disco)
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function readServiceAccount(): ServiceAccount | null {
  const raw = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? "").trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ServiceAccount>;
    if (j.client_email && j.private_key) {
      return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
    }
  } catch {
    /* JSON inválido -> tratado como ausente */
  }
  return null;
}

let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount, signal?: AbortSignal): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;

  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = enc({ alg: "RS256", typ: "JWT" });
  const claim = enc({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(sa.private_key).toString("base64url");
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    const d = await res.text().catch(() => "");
    throw new Error(`Google OAuth HTTP ${res.status}: ${d.slice(0, 160)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return tokenCache.token;
}

export class GoogleTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = "google" as const;
  private readonly apiKey = (process.env.GOOGLE_TTS_API_KEY ?? "").trim();
  private readonly serviceAccount = readServiceAccount();
  private readonly languageCode = (process.env.GOOGLE_TTS_LANGUAGE_CODE ?? "").trim() || "pt-BR";
  private readonly voiceName = (process.env.GOOGLE_TTS_VOICE_NAME ?? "").trim() || "pt-BR-Neural2-C";

  isConfigured(): boolean {
    return this.apiKey.length > 0 || this.serviceAccount !== null;
  }

  describe(): string {
    if (!this.isConfigured()) {
      return "Google TTS (ausente: GOOGLE_TTS_API_KEY ou GOOGLE_APPLICATION_CREDENTIALS_JSON)";
    }
    const auth = this.apiKey ? "api-key" : "service-account";
    return `Google TTS (${auth}, lang=${this.languageCode}, voice=${this.voiceName})`;
  }

  async synthesize(text: string, signal?: AbortSignal): Promise<TtsAudio> {
    if (!this.isConfigured()) throw new TtsNotConfiguredError(this.name);

    const body = JSON.stringify({
      input: { text },
      voice: { languageCode: this.languageCode, name: this.voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0, pitch: 0.0 },
    });

    let url = TTS_URL;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      url = `${TTS_URL}?key=${encodeURIComponent(this.apiKey)}`;
    } else if (this.serviceAccount) {
      headers.Authorization = `Bearer ${await getAccessToken(this.serviceAccount, signal)}`;
    }

    const res = await fetch(url, { method: "POST", signal, headers, body });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`Google TTS HTTP ${res.status}: ${d.slice(0, 200)}`);
    }
    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) throw new Error("Google TTS sem audioContent");
    const buf = Buffer.from(data.audioContent, "base64");
    const audio = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { audio, contentType: "audio/mpeg", provider: this.name };
  }
}
