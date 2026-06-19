// ============================================================================
// Literacia de threshold (#2) — funções PURAS. Dado um conjunto de pontos
// (p = prob. do modelo, y = churn real) e um corte, calcula a matriz de
// confusão, recall/precisão/FPR e um ROI proxy com premissas EXPLÍCITAS.
// Sem dependências de UI/React. See spec §7.
// ============================================================================

export interface Point {
  /** Probabilidade de churn prevista pelo modelo (0..1). */
  p: number;
  /** Rótulo real: 1 = cancelou, 0 = ficou. */
  y: 0 | 1;
}

export interface ThresholdCosts {
  /** Custo de intervir num membro contatado (todo flagged: TP + FP). */
  retentionCost: number;
  /** Receita perdida (LTV) quando um churn não é evitado / é capturado. */
  churnLoss: number;
  /** Fração dos churners contatados que de fato são retidos pela ação (0..1). */
  saveRate: number;
}

export interface ThresholdResult {
  cutoff: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  /** TP/(TP+FN) — 0 se denominador 0. */
  recall: number;
  /** TP/(TP+FP) — 0 se denominador 0. */
  precision: number;
  /** FP/(FP+TN) — 0 se denominador 0. */
  fpr: number;
  /** Quantos a operação contataria (TP + FP). */
  flagged: number;
  /** Benefício − custo, em R$ (premissas explícitas). */
  roi: number;
}

// Premissas alinhadas ao RoiSimulator do Dashboard: LTV = R$ 89/mês × 8 meses
// = R$ 712; custo por intervenção = R$ 40; taxa de aceite ≈ 35%.
export const DEFAULT_COSTS: ThresholdCosts = {
  retentionCost: 40,
  churnLoss: 712,
  saveRate: 0.35,
};

function safeRatio(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

export function evaluateThreshold(
  points: Point[],
  cutoff: number,
  costs: ThresholdCosts = DEFAULT_COSTS,
): ThresholdResult {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const { p, y } of points) {
    const positive = p >= cutoff;
    if (positive && y === 1) tp++;
    else if (positive && y === 0) fp++;
    else if (!positive && y === 1) fn++;
    else tn++;
  }
  const flagged = tp + fp;
  const roi = tp * costs.saveRate * costs.churnLoss - flagged * costs.retentionCost;
  return {
    cutoff,
    tp,
    fp,
    fn,
    tn,
    recall: safeRatio(tp, tp + fn),
    precision: safeRatio(tp, tp + fp),
    fpr: safeRatio(fp, fp + tn),
    flagged,
    roi,
  };
}

/** Varre cortes em [0,1] e devolve o que MAXIMIZA o ROI (o "ótimo" pedagógico). */
export function bestRoiCutoff(
  points: Point[],
  costs: ThresholdCosts = DEFAULT_COSTS,
  steps = 101,
): ThresholdResult {
  let best = evaluateThreshold(points, 0, costs);
  for (let i = 1; i < steps; i++) {
    const cutoff = i / (steps - 1);
    const r = evaluateThreshold(points, cutoff, costs);
    if (r.roi > best.roi) best = r;
  }
  return best;
}
