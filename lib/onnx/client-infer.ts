"use client";

// ============================================================================
// client-infer.ts — inferência REAL do XGBoost (ONNX) NO NAVEGADOR via WASM
// (onnxruntime-web). Sem função serverless → sem o muro de 250 MB da Vercel;
// roda no cliente: instantâneo (sem ida-e-volta ao servidor) e custo zero.
// Reaproveita o pré-processamento em JS (preprocess.ts, espelha features.py) e o
// model.onnx (653 KB, servido de /public/onnx). Ver ADR-0017.
//
// O motor WASM é carregado sob demanda (dynamic import → code-split) e seus
// binários .wasm vêm do CDN jsDelivr na MESMA versão do onnxruntime-web instalado
// (evita o atrito de empacotar .wasm no Turbopack). Single-thread (numThreads=1)
// para não exigir cross-origin isolation (SharedArrayBuffer/COOP-COEP).
// ============================================================================

import { buildInputVector } from "./preprocess";
import type { CustomerFeatures } from "@/lib/types";

// Manter em sincronia com a versão de "onnxruntime-web" no package.json.
const ORT_WEB_VERSION = "1.27.0";
const MODEL_URL = "/onnx/model.onnx";

type Ort = typeof import("onnxruntime-web");

let ortPromise: Promise<Ort> | null = null;
let sessionPromise: Promise<import("onnxruntime-web").InferenceSession> | null = null;

function loadOrt(): Promise<Ort> {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web").then((ort) => {
      ort.env.wasm.numThreads = 1; // sem SharedArrayBuffer/COOP-COEP
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WEB_VERSION}/dist/`;
      return ort;
    });
  }
  return ortPromise;
}

function getSession(): Promise<import("onnxruntime-web").InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = loadOrt().then((ort) => ort.InferenceSession.create(MODEL_URL));
  }
  return sessionPromise;
}

/** Probabilidade de churn (classe 1) do XGBoost real, calculada no navegador. */
export async function inferChurnProbBrowser(features: CustomerFeatures): Promise<number> {
  const ort = await loadOrt();
  const session = await getSession();
  const vec = buildInputVector(features);
  const tensor = new ort.Tensor("float32", vec, [1, vec.length]);
  const out = await session.run({ input: tensor });
  const keys = Object.keys(out);
  const probKey = keys.includes("probabilities")
    ? "probabilities"
    : (keys.find((k) => k !== "label") ?? keys[0]);
  const data = out[probKey].data as Float32Array;
  const prob = Number(data[data.length - 1]); // coluna da classe 1 (churn)
  if (!Number.isFinite(prob)) throw new Error("ONNX: saída inválida");
  return prob;
}
