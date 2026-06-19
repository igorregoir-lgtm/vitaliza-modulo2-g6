// ============================================================================
// Pré-processamento em JS para a inferência ONNX (espelha pipeline/features.py +
// o ColumnTransformer winsor→impute→scale, via params extraídos no export).
// Validado contra o predict() de produção (max |Δ| = 5e-5). Ver pipeline/export_onnx.py.
// ============================================================================

import params from "./preprocess_params.json";
import type { CustomerFeatures } from "@/lib/types";

interface PreprocessParams {
  numeric: string[];
  binary: string[];
  winsor: Record<string, { lower: number; upper: number }>;
  median: Record<string, number>;
  mean: Record<string, number>;
  scale: Record<string, number>;
  threshold: number;
  model_version: string;
}

const P = params as PreprocessParams;

/** Features derivadas — espelha pipeline/features.py (leakage-safe, estado atual). */
function derive(f: CustomerFeatures): Record<string, number> {
  const total = Number(f.Avg_class_frequency_total ?? 0);
  const cur = Number(f.Avg_class_frequency_current_month ?? 0);
  const life = Number(f.Lifetime ?? 0);
  return {
    ...(f as unknown as Record<string, number>),
    ratio_freq_atual_vs_lifetime: total !== 0 ? cur / total : 0,
    delta_freq: cur - total,
    flag_early_user: life <= 1 ? 1 : 0,
    flag_sleeping_dog: life > 6 && cur < 0.5 ? 1 : 0,
    contract_x_lifetime: Number(f.Contract_period ?? 0) * life,
  };
}

/** Vetor de entrada do ONNX, na ordem [numéricas escaladas..., binárias...]. */
export function buildInputVector(f: CustomerFeatures): Float32Array {
  const d = derive(f);
  const vec: number[] = [];
  for (const c of P.numeric) {
    let v = Number(d[c] ?? 0);
    const w = P.winsor[c];
    if (w) v = Math.min(Math.max(v, w.lower), w.upper);
    if (Number.isNaN(v)) v = P.median[c];
    v = (v - P.mean[c]) / P.scale[c];
    vec.push(v);
  }
  for (const c of P.binary) vec.push(Number(d[c] ?? 0));
  return Float32Array.from(vec);
}

export const THRESHOLD = P.threshold;
export const MODEL_VERSION = P.model_version;
export const N_FEATURES = P.numeric.length + P.binary.length;
