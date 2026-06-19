import { describe, it, expect } from "vitest";
import { calibrationBins, brierScore } from "./calibration";
import type { Point } from "./threshold";

describe("calibrationBins", () => {
  it("lista vazia ⇒ []", () => {
    expect(calibrationBins([])).toEqual([]);
  });

  it("contagem dos bins soma o total de pontos", () => {
    const pts: Point[] = [
      { p: 0.05, y: 0 },
      { p: 0.15, y: 0 },
      { p: 0.55, y: 1 },
      { p: 0.95, y: 1 },
      { p: 1.0, y: 1 },
    ];
    const bins = calibrationBins(pts, 10);
    expect(bins).toHaveLength(10);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(pts.length);
    // p === 1 cai no último bin
    expect(bins[9].count).toBe(2); // 0.95 e 1.0
  });

  it("observed = fração real de y=1 dentro do bin", () => {
    // tudo no primeiro decil [0,0.1): 4 pontos, 1 churn ⇒ observed 0.25
    const pts: Point[] = [
      { p: 0.02, y: 0 },
      { p: 0.04, y: 0 },
      { p: 0.06, y: 0 },
      { p: 0.08, y: 1 },
    ];
    const bins = calibrationBins(pts, 10);
    expect(bins[0].count).toBe(4);
    expect(bins[0].observed).toBeCloseTo(0.25, 6);
    expect(bins[0].predicted).toBeCloseTo(0.05, 6);
  });
});

describe("brierScore", () => {
  it("previsão perfeita ⇒ 0", () => {
    expect(brierScore([{ p: 1, y: 1 }, { p: 0, y: 0 }])).toBe(0);
  });

  it("previsão totalmente errada ⇒ 1", () => {
    expect(brierScore([{ p: 1, y: 0 }, { p: 0, y: 1 }])).toBe(1);
  });

  it("lista vazia ⇒ 0", () => {
    expect(brierScore([])).toBe(0);
  });
});
