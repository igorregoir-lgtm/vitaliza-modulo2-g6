// ============================================================================
// Calibração / incerteza (#4) — funções PURAS. "Quando o modelo diz 70%, ~70%
// de fato cancelam?" Particiona [0,1] em faixas e compara a prob. média prevista
// com a frequência real observada (diagrama de confiabilidade) + Brier score.
// Sem dependências de UI/React. See spec §8.
// ============================================================================

import type { Point } from "./threshold";

export interface CalibrationBin {
  lo: number;
  hi: number;
  mid: number;
  /** Média de p no bin (eixo X do diagrama). */
  predicted: number;
  /** Fração observada de y=1 no bin (eixo Y). */
  observed: number;
  count: number;
}

export function calibrationBins(points: Point[], nBins = 10): CalibrationBin[] {
  if (points.length === 0) return [];
  const acc = Array.from({ length: nBins }, (_, i) => ({
    lo: i / nBins,
    hi: (i + 1) / nBins,
    sumP: 0,
    sumY: 0,
    count: 0,
  }));
  for (const { p, y } of points) {
    let idx = Math.floor(p * nBins);
    if (idx >= nBins) idx = nBins - 1; // p === 1 cai no último bin
    if (idx < 0) idx = 0;
    acc[idx].sumP += p;
    acc[idx].sumY += y;
    acc[idx].count += 1;
  }
  return acc.map((b) => ({
    lo: b.lo,
    hi: b.hi,
    mid: (b.lo + b.hi) / 2,
    predicted: b.count ? b.sumP / b.count : (b.lo + b.hi) / 2,
    observed: b.count ? b.sumY / b.count : 0,
    count: b.count,
  }));
}

/** Brier score = média de (p − y)². Menor é melhor; 0 = previsão perfeita. */
export function brierScore(points: Point[]): number {
  if (points.length === 0) return 0;
  const sum = points.reduce((s, { p, y }) => s + (p - y) * (p - y), 0);
  return sum / points.length;
}
