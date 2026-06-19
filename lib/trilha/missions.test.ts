import { describe, it, expect } from "vitest";
import { MISSIONS, TRILHA_TOTAL, TRILHA_EST_MIN, getMission } from "./missions";

describe("MISSIONS config", () => {
  it("tem 6 estações", () => {
    expect(MISSIONS).toHaveLength(6);
    expect(TRILHA_TOTAL).toBe(6);
  });

  it("order é 1..6, único e sequencial", () => {
    const orders = MISSIONS.map((m) => m.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(orders).size).toBe(6);
  });

  it("ids são únicos", () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(MISSIONS.length);
  });

  it("todo href casa com ?trilha=<id>", () => {
    for (const m of MISSIONS) {
      expect(m.href).toContain(`trilha=${m.id}`);
    }
  });

  it("todo check tem prompt e pelo menos uma opção correta", () => {
    for (const m of MISSIONS) {
      expect(m.check.prompt.length).toBeGreaterThan(0);
      expect(m.check.options.length).toBeGreaterThanOrEqual(2);
      expect(m.check.options.some((o) => o.correct)).toBe(true);
      // todas as opções têm feedback que ensina
      for (const o of m.check.options) {
        expect(o.feedback.length).toBeGreaterThan(0);
      }
    }
  });

  it("todo campo de texto-guia está preenchido", () => {
    for (const m of MISSIONS) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.objective.length).toBeGreaterThan(0);
      expect(m.instruction.length).toBeGreaterThan(0);
      expect(m.tutorSeed.length).toBeGreaterThan(0);
      expect(m.estMin).toBeGreaterThan(0);
    }
  });

  it("getMission resolve por id e retorna undefined p/ inválido", () => {
    expect(getMission("entender")?.order).toBe(1);
    expect(getMission("sintese")?.bloom).toBe("Criar");
    expect(getMission("inexistente")).toBeUndefined();
  });

  it("TRILHA_EST_MIN é a soma das estimativas", () => {
    expect(TRILHA_EST_MIN).toBe(MISSIONS.reduce((s, m) => s + m.estMin, 0));
  });

  it("a primeira estação sobe Bloom a partir de Entender e a última é Criar", () => {
    expect(MISSIONS[0].bloom).toBe("Entender");
    expect(MISSIONS[MISSIONS.length - 1].bloom).toBe("Criar");
  });
});
