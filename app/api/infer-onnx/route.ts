import { NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import path from "node:path";
import { buildInputVector, THRESHOLD, MODEL_VERSION } from "@/lib/onnx/preprocess";
import type { CustomerFeatures } from "@/lib/types";

// ============================================================================
// Inferência REAL leve via ONNX (caminho B da ADR-0017). Serve o XGBoost de
// produção (calibrado) recalculado a partir dos features — score-only; SHAP
// segue no surrogate (híbrido). Função Node (onnxruntime-node, addon nativo).
// PoC de preview; no cliente fica atrás de flag, com fallback à heurística.
// ============================================================================

export const runtime = "nodejs";

let sessionPromise: Promise<ort.InferenceSession> | null = null;
function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    const modelPath = path.join(process.cwd(), "lib", "onnx", "model.onnx");
    sessionPromise = ort.InferenceSession.create(modelPath);
  }
  return sessionPromise;
}

function tierFromProb(p: number): "baixo" | "medio" | "alto" {
  if (p < 0.3) return "baixo";
  if (p < 0.6) return "medio";
  return "alto";
}

export async function POST(req: Request) {
  try {
    const features = (await req.json()) as CustomerFeatures;
    const vec = buildInputVector(features);
    const session = await getSession();
    const tensor = new ort.Tensor("float32", vec, [1, vec.length]);
    const out = await session.run({ input: tensor });
    const probKey = "probabilities" in out ? "probabilities" : Object.keys(out).find((k) => k !== "label")!;
    const data = out[probKey].data as Float32Array;
    const prob = Number(data[data.length - 1]); // coluna da classe 1 (churn)
    return NextResponse.json({
      churn_probability: Number(prob.toFixed(4)),
      risk_tier: tierFromProb(prob),
      threshold: THRESHOLD,
      model_version: MODEL_VERSION,
      source: "xgboost-onnx",
    });
  } catch (err) {
    console.error("[infer-onnx]", err);
    return NextResponse.json({ error: String(err), source: "error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", fn: "infer-onnx", method: "POST com features" });
}
