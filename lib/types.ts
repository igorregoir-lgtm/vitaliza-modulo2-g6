// ============================================================================
// Vitaliza — domain types. Mirror of the Supabase schema (see
// supabase/migrations/20260617090000_init.sql) plus the inference contract.
// ============================================================================

export type UserRole = "cs" | "exec" | "admin";

export type RiskTier = "baixo" | "medio" | "alto" | "critico";

export type Archetype =
  | "preco_sensivel"
  | "desengajado_conteudo"
  | "early_dropper"
  | "sleeping_dog"
  | "concorrente_driven";

export type InterventionStatus = "sugerida" | "aplicada" | "descartada" | "bloqueada";

/** Raw model feature snapshot (gym_churn_us.csv schema + derived). */
export interface CustomerFeatures {
  gender: number;
  Near_Location: number;
  Partner: number;
  Promo_friends: number;
  Phone: number;
  Contract_period: number;
  Group_visits: number;
  Age: number;
  Avg_additional_charges_total: number;
  Month_to_end_contract: number;
  Lifetime: number;
  Avg_class_frequency_total: number;
  Avg_class_frequency_current_month: number;
  // derived (case-critical)
  ratio_freq_atual_vs_lifetime?: number;
  flag_early_user?: number;
  flag_sleeping_dog?: number;
  delta_freq?: number;
}

export interface Customer {
  id: number | string;
  external_ref: string;
  features: CustomerFeatures;
  true_churn?: number | null;
}

/** A single SHAP driver. shap_value > 0 pushes toward churn. */
export interface ShapDriver {
  feature: string;
  shap_value: number;
  value: number | string;
  actionable: boolean;
  direction: "up" | "down";
}

export interface ShapLocal {
  base_value: number;
  contributions: ShapDriver[];
}

/** Contract shape returned by predict(). */
export interface PredictResult {
  customer_id: number | string;
  churn_probability: number;
  risk_tier: RiskTier;
  threshold: number;
  archetype: Archetype;
  proactive_allowed: boolean;
  model_version: string;
  top_drivers: ShapDriver[];
  shap_local: ShapLocal;
}

/** Explain endpoint payload: prediction + the raw feature snapshot (for the
 *  client-side what-if simulator). See ADR-0014. */
export interface ExplainResponse extends PredictResult {
  features: CustomerFeatures;
}

export interface Recommendation {
  offer: string;
  channel: string[];
  copy: string;
  timing: string;
}

/** Function A (narrative) + Function B (recommendation), from the advisor agent. */
export interface AdvisorResult {
  narrative: string;
  recommendation: Recommendation | null;
  blocked: boolean;
  blocked_reason?: string;
}

export interface CohortStat {
  cohort: string;
  total: number;
  churn: number;
  churn_rate: number;
}

export interface ContractStat {
  contract: number;
  label: string;
  total: number;
  churn: number;
  churn_rate: number;
}

export interface FreqDistBucket {
  bucket: string;
  churn: number;
  retained: number;
}

export interface ScatterPoint {
  freq_total: number;
  freq_current: number;
  churned: boolean;
  sleeping_dog: boolean;
}

export interface CorrelationCell {
  x: string;
  y: string;
  value: number;
}

export interface LifetimeSurvival {
  lifetime: number;
  retention: number;
}

export interface EdaSummary {
  n: number;
  churn_rate: number;
  by_contract: ContractStat[];
  by_cohort: CohortStat[];
  freq_dist: FreqDistBucket[];
  scatter: ScatterPoint[];
  correlation: CorrelationCell[];
  survival: LifetimeSurvival[];
}

export interface CohortStatsResult {
  n: number;
  churn_rate: number;
  tier_split: { tier: RiskTier; count: number }[];
  archetype_split: { archetype: Archetype; count: number }[];
  avg_score: number;
  score_trend: { period: string; avg_score: number }[];
}

export interface PrincipiosContent {
  titulo: string;
  resumo: string;
  principios: { nome: string; texto: string }[];
  base_legal: string;
}
