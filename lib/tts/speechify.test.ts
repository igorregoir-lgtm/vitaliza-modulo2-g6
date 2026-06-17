import { describe, it, expect } from "vitest";
import { normalizeForSpeech, chunkForSpeech } from "./speechify";

describe("normalizeForSpeech", () => {
  it("remove ênfase markdown, mantém o texto", () => {
    expect(normalizeForSpeech("**Olá** _mundo_")).toBe("Olá mundo.");
  });
  it("converte links e remove URLs cruas", () => {
    const out = normalizeForSpeech("Veja [o painel](https://x.com) e https://y.com agora");
    expect(out).toContain("o painel");
    expect(out).not.toContain("http");
  });
  it("trata porcentagem e moeda em pt-BR", () => {
    expect(normalizeForSpeech("Churn de 26,5%")).toContain("por cento");
    expect(normalizeForSpeech("Custo R$ 100")).toContain("100 reais");
  });
  it("reduz marcador de lista e barra", () => {
    expect(normalizeForSpeech("- item um")).not.toContain("- ");
    expect(normalizeForSpeech("LTV/CAC")).toBe("LTV CAC.");
  });
  it("remove blocos de código", () => {
    expect(normalizeForSpeech("antes ```const x=1``` depois")).not.toContain("const x");
  });
  it("garante pontuação final", () => {
    expect(normalizeForSpeech("teste").endsWith(".")).toBe(true);
  });
  it("string vazia -> vazio", () => {
    expect(normalizeForSpeech("")).toBe("");
  });
});

describe("chunkForSpeech", () => {
  it("não quebra texto curto", () => {
    expect(chunkForSpeech("Frase curta.").length).toBe(1);
  });
  it("quebra texto longo em blocos faláveis", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Esta é a frase número ${i}.`).join(" ");
    const chunks = chunkForSpeech(long, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(280);
  });
});
