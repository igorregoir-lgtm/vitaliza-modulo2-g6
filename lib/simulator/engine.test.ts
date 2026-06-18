import { describe, it, expect } from "vitest";
import type { CustomerFeatures } from "../types";
import { predictHeuristic, tierFromProb } from "../heuristic";
import {
  clamp01,
  simulate,
  projectAnchored,
  findCheapestLever,
  leverEffort,
} from "./engine";
import { LEVERS } from "./levers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A churn-prone but reachable member: low current frequency, short contract,
 *  close to contract end, but recently tenured enough to NOT be a sleeping dog. */
const atRisk: CustomerFeatures = {
  gender: 1,
  Near_Location: 1,
  Partner: 0,
  Promo_friends: 0,
  Phone: 1,
  Contract_period: 1,
  Group_visits: 0,
  Age: 28,
  Avg_additional_charges_total: 40,
  Month_to_end_contract: 1,
  Lifetime: 3,
  Avg_class_frequency_total: 2.2,
  Avg_class_frequency_current_month: 0.6,
};

/** Sleeping dog: long tenure (>6) + near-zero current usage (<0.5). */
const sleepingDog: CustomerFeatures = {
  ...atRisk,
  Lifetime: 12,
  Avg_class_frequency_current_month: 0.2,
  Avg_class_frequency_total: 2.0,
};

/** Healthy member already in the lowest tier. */
const healthy: CustomerFeatures = {
  gender: 1,
  Near_Location: 1,
  Partner: 1,
  Promo_friends: 1,
  Phone: 1,
  Contract_period: 12,
  Group_visits: 1,
  Age: 30,
  Avg_additional_charges_total: 200,
  Month_to_end_contract: 11,
  Lifetime: 10,
  Avg_class_frequency_total: 2.5,
  Avg_class_frequency_current_month: 2.6,
};

// ---------------------------------------------------------------------------
// clamp01
// ---------------------------------------------------------------------------

describe("clamp01", () => {
  it("mantém probabilidades válidas", () => {
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });
  it("recorta abaixo de 0 e acima de 1", () => {
    expect(clamp01(-0.3)).toBe(0);
    expect(clamp01(1.8)).toBe(1);
  });
  it("NaN vira 0", () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// simulate
// ---------------------------------------------------------------------------

describe("simulate", () => {
  it("devolve um PredictResult completo da versão simulada", () => {
    const out = simulate(atRisk, { Group_visits: 1 });
    expect(out).toHaveProperty("churn_probability");
    expect(out).toHaveProperty("risk_tier");
    expect(out).toHaveProperty("archetype");
    expect(out).toHaveProperty("top_drivers");
    expect(out.churn_probability).toBeGreaterThanOrEqual(0);
    expect(out.churn_probability).toBeLessThanOrEqual(1);
  });

  it("não muta o objeto base", () => {
    const snapshot = JSON.stringify(atRisk);
    simulate(atRisk, { Avg_class_frequency_current_month: 5 });
    expect(JSON.stringify(atRisk)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Anchoring — §11: projected == clamp(real + simNew - simBaseline)
// ---------------------------------------------------------------------------

describe("projectAnchored — ancoragem honesta", () => {
  it("projected == clamp01(realProb + simNew - simBaseline)", () => {
    const realProb = 0.62;
    const overrides = { Avg_class_frequency_current_month: 3.0 };
    const p = projectAnchored(atRisk, realProb, overrides);
    expect(p.projected).toBeCloseTo(
      clamp01(realProb + p.simNew - p.simBaseline),
      10,
    );
  });

  it("deltaPP == Math.round((projected - realProb) * 100)", () => {
    const realProb = 0.62;
    const p = projectAnchored(atRisk, realProb, {
      Avg_class_frequency_current_month: 3.0,
    });
    expect(p.deltaPP).toBe(Math.round((p.projected - realProb) * 100));
  });

  it("modo amostra: realProb == heuristica_base ⇒ projected == heuristica_modificada", () => {
    const baseProb = predictHeuristic("x", atRisk).churn_probability;
    const overrides = { Avg_class_frequency_current_month: 3.5 };
    const p = projectAnchored(atRisk, baseProb, overrides);
    const heuristicaModificada = simulate(atRisk, overrides).churn_probability;
    expect(p.projected).toBeCloseTo(clamp01(heuristicaModificada), 10);
  });

  it("clamp nos limites: realProb alto + delta positivo não passa de 1", () => {
    // realProb=0.98, piorar a frequência empurra acima de 1 -> recorta em 1.
    const p = projectAnchored(atRisk, 0.98, {
      Avg_class_frequency_current_month: 0,
    });
    expect(p.projected).toBeLessThanOrEqual(1);
    expect(p.projected).toBeGreaterThanOrEqual(0);
  });

  it("clamp nos limites: realProb baixo + delta negativo não passa de 0", () => {
    const p = projectAnchored(atRisk, 0.02, {
      Avg_class_frequency_current_month: 5,
    });
    expect(p.projected).toBeGreaterThanOrEqual(0);
    expect(p.projected).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Monotonicity — §11: ↑frequência ⇒ ↓prob
// ---------------------------------------------------------------------------

describe("monotonicidade da frequência (alavanca herói)", () => {
  it("aumentar a frequência reduz a probabilidade de churn", () => {
    const low = simulate(atRisk, {
      Avg_class_frequency_current_month: 0.5,
    }).churn_probability;
    const mid = simulate(atRisk, {
      Avg_class_frequency_current_month: 2.5,
    }).churn_probability;
    const high = simulate(atRisk, {
      Avg_class_frequency_current_month: 5,
    }).churn_probability;
    expect(mid).toBeLessThan(low);
    expect(high).toBeLessThan(mid);
  });

  it("a projeção ancorada também cai ao subir a frequência", () => {
    const realProb = predictHeuristic("x", atRisk).churn_probability;
    const low = projectAnchored(atRisk, realProb, {
      Avg_class_frequency_current_month: 0.5,
    }).projected;
    const high = projectAnchored(atRisk, realProb, {
      Avg_class_frequency_current_month: 5,
    }).projected;
    expect(high).toBeLessThan(low);
  });
});

// ---------------------------------------------------------------------------
// findCheapestLever — §7 / §11
// ---------------------------------------------------------------------------

describe("findCheapestLever", () => {
  it("acha uma alavanca válida num caso crítico e ela baixa o tier", () => {
    const realProb = predictHeuristic("x", atRisk).churn_probability;
    const fromTier = tierFromProb(realProb);
    // pré-condição do caso de teste: não está em 'baixo'
    expect(fromTier).not.toBe("baixo");

    const sug = findCheapestLever(atRisk, realProb);
    expect(sug).not.toBeNull();
    if (!sug) return;

    // a sugestão realmente cruza para um tier estritamente menor
    const order = ["baixo", "medio", "alto", "critico"];
    expect(order.indexOf(sug.toTier)).toBeLessThan(order.indexOf(sug.fromTier));
    expect(sug.fromTier).toBe(fromTier);
    // a humanAction e o valor projetado são coerentes
    expect(typeof sug.humanAction).toBe("string");
    expect(sug.humanAction.length).toBeGreaterThan(0);
    expect(tierFromProb(sug.projected)).toBe(sug.toTier);
    expect(sug.toValue).not.toBe(sug.fromValue);
  });

  it("retorna null para sleeping_dog (não-intrusão)", () => {
    const pred = predictHeuristic("x", sleepingDog);
    expect(pred.archetype).toBe("sleeping_dog");
    const sug = findCheapestLever(sleepingDog, pred.churn_probability);
    expect(sug).toBeNull();
  });

  it("retorna null quando já está no tier 'baixo'", () => {
    const realProb = predictHeuristic("x", healthy).churn_probability;
    expect(tierFromProb(realProb)).toBe("baixo");
    expect(findCheapestLever(healthy, realProb)).toBeNull();
  });

  it("retorna null quando proactive_allowed é false (qualquer motivo)", () => {
    // sleeping_dog já cobre proactive_allowed=false; reforça o contrato.
    const pred = predictHeuristic("x", sleepingDog);
    expect(pred.proactive_allowed).toBe(false);
    expect(findCheapestLever(sleepingDog, pred.churn_probability)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// leverEffort — §7: custo fixo por nível (não delta bruto) p/ select
// ---------------------------------------------------------------------------

describe("leverEffort — custo por nível (§7)", () => {
  const contract = LEVERS.find((l) => l.feature === "Contract_period")!;

  it("select conta passos entre opções, não o delta bruto", () => {
    // options [1,3,6,12]: 1→12 são 3 níveis, não 11.
    expect(leverEffort(contract, 1, 12)).toBe(3);
    expect(leverEffort(contract, 1, 3)).toBe(1);
    expect(leverEffort(contract, 6, 12)).toBe(1);
    expect(leverEffort(contract, 3, 12)).toBe(2);
  });

  it("slider é normalizado em [0,1]", () => {
    const freq = LEVERS.find(
      (l) => l.feature === "Avg_class_frequency_current_month",
    )!;
    // min 0, max 5: mover 0→2.5 = metade do range.
    expect(leverEffort(freq, 0, 2.5)).toBeCloseTo(0.5, 10);
  });

  it("toggle custa um nível", () => {
    const group = LEVERS.find((l) => l.feature === "Group_visits")!;
    expect(leverEffort(group, 0, 1)).toBe(1);
  });
});
