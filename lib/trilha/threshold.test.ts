import { describe, it, expect } from "vitest";
import { evaluateThreshold, bestRoiCutoff, DEFAULT_COSTS, type Point } from "./threshold";

const SET: Point[] = [
  { p: 0.9, y: 1 },
  { p: 0.8, y: 1 },
  { p: 0.6, y: 0 },
  { p: 0.3, y: 0 },
  { p: 0.2, y: 1 },
];

describe("evaluateThreshold", () => {
  it("matriz de confusão num conjunto conhecido (cutoff 0.5)", () => {
    const r = evaluateThreshold(SET, 0.5, DEFAULT_COSTS);
    expect(r).toMatchObject({ tp: 2, fp: 1, fn: 1, tn: 1, flagged: 3 });
    expect(r.recall).toBeCloseTo(2 / 3, 6);
    expect(r.precision).toBeCloseTo(2 / 3, 6);
    expect(r.fpr).toBeCloseTo(1 / 2, 6);
  });

  it("ROI segue a fórmula tp*saveRate*churnLoss − flagged*retentionCost", () => {
    const r = evaluateThreshold(SET, 0.5, DEFAULT_COSTS);
    const expected = 2 * DEFAULT_COSTS.saveRate * DEFAULT_COSTS.churnLoss - 3 * DEFAULT_COSTS.retentionCost;
    expect(r.roi).toBeCloseTo(expected, 6);
  });

  it("cutoff 0 ⇒ tudo positivo ⇒ recall 1", () => {
    const r = evaluateThreshold(SET, 0);
    expect(r.tp).toBe(3); // 3 churners
    expect(r.fp).toBe(2);
    expect(r.fn).toBe(0);
    expect(r.recall).toBe(1);
  });

  it("cutoff acima do máximo ⇒ nada positivo, sem NaN", () => {
    const r = evaluateThreshold(SET, 1.01);
    expect(r.tp).toBe(0);
    expect(r.fp).toBe(0);
    expect(r.recall).toBe(0);
    expect(r.precision).toBe(0);
    expect(r.fpr).toBe(0);
    expect(Number.isNaN(r.roi)).toBe(false);
  });

  it("lista vazia ⇒ zeros, sem NaN", () => {
    const r = evaluateThreshold([], 0.5);
    expect(r).toMatchObject({ tp: 0, fp: 0, fn: 0, tn: 0, recall: 0, precision: 0, fpr: 0, roi: 0 });
  });
});

describe("bestRoiCutoff", () => {
  it("retorna um corte em [0,1] com ROI >= ao de qualquer corte testado", () => {
    const best = bestRoiCutoff(SET);
    expect(best.cutoff).toBeGreaterThanOrEqual(0);
    expect(best.cutoff).toBeLessThanOrEqual(1);
    // nenhum corte arbitrário supera o melhor
    for (let i = 0; i <= 100; i++) {
      expect(evaluateThreshold(SET, i / 100).roi).toBeLessThanOrEqual(best.roi + 1e-9);
    }
  });
});
