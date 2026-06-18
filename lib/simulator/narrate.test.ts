import { describe, it, expect } from "vitest";
import { buildNarration, NARRATION_DISCLAIMER } from "./narrate";

describe("buildNarration", () => {
  const baseArgs = {
    realProb: 0.62,
    projected: 0.41,
    deltaPP: -21,
    changedLevers: [
      { label: "Frequência de aulas no mês", toValue: 3, unit: "aulas/sem" },
    ],
    topDriverLabel: "frequência de aulas",
    topDriverDir: "down" as const,
  };

  it("cita o maior driver", () => {
    const s = buildNarration(baseArgs);
    expect(s).toContain("frequência de aulas");
  });

  it("indica a direção certa (para baixo)", () => {
    const s = buildNarration(baseArgs);
    expect(s).toContain("para baixo");
    expect(s).not.toContain("para cima");
  });

  it("indica a direção certa (para cima)", () => {
    const s = buildNarration({
      ...baseArgs,
      deltaPP: 18,
      projected: 0.8,
      topDriverDir: "up",
    });
    expect(s).toContain("para cima");
    expect(s).not.toContain("puxando o risco para baixo");
  });

  it("contém o disclaimer de comportamento do modelo, não causalidade", () => {
    const s = buildNarration(baseArgs);
    expect(s).toContain(NARRATION_DISCLAIMER);
    expect(s).toContain("comportamento do modelo");
    expect(s).toContain("não causalidade");
  });

  it("termina com o disclaimer", () => {
    const s = buildNarration(baseArgs);
    expect(s.trim().endsWith(NARRATION_DISCLAIMER)).toBe(true);
  });

  it("reflete a queda em pontos percentuais", () => {
    const s = buildNarration(baseArgs);
    expect(s).toContain("21 p.p.");
    expect(s).toContain("queda");
  });

  it("reflete a alta em pontos percentuais", () => {
    const s = buildNarration({
      ...baseArgs,
      deltaPP: 18,
      projected: 0.8,
      topDriverDir: "up",
    });
    expect(s).toContain("18 p.p.");
    expect(s).toContain("alta");
  });

  it("cita o antes e o depois em porcentagem", () => {
    const s = buildNarration(baseArgs);
    expect(s).toContain("62%");
    expect(s).toContain("41%");
  });

  it("lida com nenhuma alavanca alterada", () => {
    const s = buildNarration({ ...baseArgs, changedLevers: [], deltaPP: 0, projected: 0.62 });
    expect(s).toContain("Sem ajustes");
    expect(s).toContain(NARRATION_DISCLAIMER);
  });
});
