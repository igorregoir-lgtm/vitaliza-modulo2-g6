// ============================================================================
// Simulator engine — pure, client-safe what-if core.
// See docs/superpowers/specs/2026-06-17-simulador-vivo-design.md §5 (contracts)
// and §7 (optimizer algorithm).
//
// Honest anchoring (ADR-0014):
//   projected = clamp01( realProb + (heuristicNew - heuristicBaseline) )
// The delta comes from the transparent heuristic; the starting point is the
// real XGBoost score. Never touches the real model.
// ============================================================================

import type { CustomerFeatures, PredictResult, RiskTier } from "../types";
import { predictHeuristic, tierFromProb } from "../heuristic";
import { LEVERS, type LeverDef } from "./levers";

/** Clamp any probability into the valid [0, 1] range. */
export function clamp01(p: number): number {
  if (Number.isNaN(p)) return 0;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Re-score the transparent heuristic over a member with some features
 * overridden. `deriveFeatures` (inside predictHeuristic) recomputes ratio/flags
 * so the archetype can flip live.
 */
export function simulate(
  base: CustomerFeatures,
  overrides: Partial<CustomerFeatures>,
): PredictResult {
  const merged: CustomerFeatures = { ...base, ...overrides };
  return predictHeuristic("sim", merged);
}

export interface Projection {
  /** heuristic probability over the unmodified base */
  simBaseline: number;
  /** heuristic probability over {...base, ...overrides} */
  simNew: number;
  /** clamp01(realProb + simNew - simBaseline) */
  projected: number;
  /** Math.round((projected - realProb) * 100) */
  deltaPP: number;
  /** full simulated PredictResult (gauge / waterfall / archetype) */
  predNew: PredictResult;
}

/**
 * Anchor the transparent delta on the real score. The displayed delta is the
 * heuristic's reaction to the intervention; the baseline is the real probability.
 */
export function projectAnchored(
  base: CustomerFeatures,
  realProb: number,
  overrides: Partial<CustomerFeatures>,
): Projection {
  const baselinePred = predictHeuristic("sim-base", base);
  const predNew = simulate(base, overrides);
  const simBaseline = baselinePred.churn_probability;
  const simNew = predNew.churn_probability;
  const projected = clamp01(realProb + simNew - simBaseline);
  const deltaPP = Math.round((projected - realProb) * 100);
  return { simBaseline, simNew, projected, deltaPP, predNew };
}

export interface LeverSuggestion {
  feature: keyof CustomerFeatures;
  label: string;
  fromValue: number;
  toValue: number;
  humanAction: string;
  projected: number;
  fromTier: RiskTier;
  toTier: RiskTier;
}

const TIER_ORDER: RiskTier[] = ["baixo", "medio", "alto", "critico"];

function tierRank(t: RiskTier): number {
  return TIER_ORDER.indexOf(t);
}

/** Candidate values for a lever, in ascending order, within its declared range. */
function leverValues(lever: LeverDef): number[] {
  if (lever.control === "select" && lever.options) {
    return [...lever.options];
  }
  const min = lever.min ?? 0;
  const max = lever.max ?? 0;
  const step = lever.step ?? 1;
  const values: number[] = [];
  // Guard against float drift by rounding to the step's precision.
  const decimals = (String(step).split(".")[1] ?? "").length;
  for (let v = min; v <= max + 1e-9; v += step) {
    values.push(Number(v.toFixed(decimals)));
  }
  return values;
}

/**
 * Effort of moving a lever from one value to another, used to rank interventions
 * (§7). Sliders: normalized |Δ| / (max−min) in [0,1]. Toggle/select: fixed cost
 * per LEVEL — for a select the levels are the option indices, NOT the raw value
 * gap (options can be non-uniform, e.g. [1, 3, 6, 12], so 1→12 is 3 levels, not 11).
 * Exported for tests.
 */
export function leverEffort(lever: LeverDef, fromValue: number, toValue: number): number {
  if (lever.control === "slider" && lever.min != null && lever.max != null) {
    const span = lever.max - lever.min;
    const delta = Math.abs(toValue - fromValue);
    return span > 0 ? delta / span : delta;
  }
  if (lever.control === "select" && lever.options) {
    const fromIdx = lever.options.indexOf(fromValue);
    const toIdx = lever.options.indexOf(toValue);
    if (fromIdx >= 0 && toIdx >= 0) return Math.abs(toIdx - fromIdx);
  }
  // toggle (and any select value outside its options): one level of change.
  return Math.abs(toValue - fromValue);
}

/**
 * Cheapest single-lever intervention that drops the member at least one tier.
 * Returns null when intervention is not allowed (sleeping_dog /
 * proactive_allowed === false), the member is already 'baixo', or no single
 * lever crosses into a lower tier within its range. (§7)
 */
export function findCheapestLever(
  base: CustomerFeatures,
  realProb: number,
): LeverSuggestion | null {
  const basePred = predictHeuristic("sim-base", base);

  // Non-intrusion: never wake a sleeping dog / disallowed proactive contact.
  if (basePred.archetype === "sleeping_dog" || basePred.proactive_allowed === false) {
    return null;
  }

  const fromTier = tierFromProb(realProb);
  // Already at the lowest tier: nothing to optimize.
  if (fromTier === "baixo") {
    return null;
  }

  let best: (LeverSuggestion & { _effort: number }) | null = null;

  for (const lever of LEVERS) {
    const fromValue = Number(base[lever.feature] ?? 0);
    const candidates = leverValues(lever);

    for (const toValue of candidates) {
      if (toValue === fromValue) continue;

      const { projected } = projectAnchored(base, realProb, {
        [lever.feature]: toValue,
      } as Partial<CustomerFeatures>);
      const toTier = tierFromProb(projected);

      // Must strictly lower the tier.
      if (tierRank(toTier) >= tierRank(fromTier)) continue;

      const candidateEffort = leverEffort(lever, fromValue, toValue);
      const candidate: LeverSuggestion & { _effort: number } = {
        feature: lever.feature,
        label: lever.label,
        fromValue,
        toValue,
        humanAction: lever.humanAction(toValue),
        projected,
        fromTier,
        toTier,
        _effort: candidateEffort,
      };

      if (best === null || candidateEffort < best._effort) {
        best = candidate;
      }
    }
  }

  if (best === null) return null;
  // strip internal field
  const { _effort, ...suggestion } = best;
  void _effort;
  return suggestion;
}
