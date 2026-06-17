import { describe, it, expect, beforeEach } from "vitest";
import { providerOrder, getTtsStatus, synthesizeSpeech } from "./index";

describe("seleção de provider e fallback", () => {
  beforeEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.GOOGLE_TTS_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.TTS_PROVIDER;
    delete process.env.TTS_FALLBACK_PROVIDER;
    delete process.env.TTS_ENABLED;
  });

  it("ordem padrão: principal elevenlabs, fallback google", () => {
    expect(providerOrder()).toEqual(["elevenlabs", "google"]);
  });

  it("respeita TTS_PROVIDER/FALLBACK e sempre inclui ambos", () => {
    process.env.TTS_PROVIDER = "google";
    process.env.TTS_FALLBACK_PROVIDER = "elevenlabs";
    expect(providerOrder()).toEqual(["google", "elevenlabs"]);
  });

  it("status sem credencial: nada configurado e voz do servidor indisponível", () => {
    const s = getTtsStatus();
    expect(s.anyConfigured).toBe(false);
    expect(s.serverVoiceAvailable).toBe(false);
    expect(s.providers.every((p) => !p.configured)).toBe(true);
  });

  it("síntese sem credencial -> nao_configurado (modo degradado)", async () => {
    const out = await synthesizeSpeech("Olá, mundo!");
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("nao_configurado");
  });

  it("TTS desativado -> reason desativado", async () => {
    process.env.TTS_ENABLED = "false";
    const out = await synthesizeSpeech("Olá");
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("desativado");
  });
});
