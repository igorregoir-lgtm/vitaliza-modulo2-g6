"use client";

// ============================================================================
// useOnlineProjection — wire da inferência REAL (XGBoost via ONNX) no Simulador
// Vivo, rodando NO NAVEGADOR (onnxruntime-web/WASM, ver client-infer.ts). Ver
// ADR-0017.
//
// LIGADO por padrão (client-side é seguro): quando há intervenção, busca a prob.
// real do XGBoost para {...features, ...overrideDelta} e a devolve ao simulador,
// que a usa como "Projeção" no lugar da heurística ancorada. SHAP/arquétipo
// seguem no surrogate transparente (HÍBRIDO — score real + explicação surrogate).
//
// Fail-safe por construção: qualquer erro (WASM indisponível, CDN bloqueado etc.)
// → status "error", prob null → o simulador mantém a heurística ancorada
// (ADR-0014), zero regressão. Desligar de propósito: NEXT_PUBLIC_ONLINE_INFERENCE=0.
// Corrida resolvida por id incremental (só a última resposta vale).
// ============================================================================

import * as React from "react";
import type { CustomerFeatures } from "@/lib/types";
import { inferChurnProbBrowser } from "./client-infer";

/** Pública (inlined em build). LIGADA por padrão; "0"/"false" desliga. */
export const ONLINE_INFERENCE_ENABLED =
  process.env.NEXT_PUBLIC_ONLINE_INFERENCE !== "0" &&
  process.env.NEXT_PUBLIC_ONLINE_INFERENCE !== "false";

export type OnlineStatus = "off" | "loading" | "ok" | "error";

export interface OnlineProjection {
  /** Prob. real do XGBoost p/ as features mescladas, ou null quando indisponível. */
  prob: number | null;
  /** 'off' = desligada; senão o estado da última inferência. */
  status: OnlineStatus;
}

export function useOnlineProjection(
  features: CustomerFeatures,
  overrideDelta: Partial<CustomerFeatures>,
): OnlineProjection {
  const [result, setResult] = React.useState<OnlineProjection>({
    prob: null,
    status: ONLINE_INFERENCE_ENABLED ? "loading" : "off",
  });
  const reqId = React.useRef(0);

  const hasDelta = Object.keys(overrideDelta).length > 0;

  React.useEffect(() => {
    // Desligada ou sem intervenção: nada a inferir (em repouso a projeção é o score real).
    if (!ONLINE_INFERENCE_ENABLED || !hasDelta) return;
    const id = ++reqId.current;
    let active = true;
    void (async () => {
      try {
        const p = await inferChurnProbBrowser({ ...features, ...overrideDelta });
        if (!active || id !== reqId.current) return; // resposta obsoleta
        setResult(
          Number.isFinite(p) ? { prob: p, status: "ok" } : { prob: null, status: "error" },
        );
      } catch {
        if (!active || id !== reqId.current) return;
        setResult({ prob: null, status: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, [features, overrideDelta, hasDelta]);

  // Curto-circuito explícito quando desligada (não importa o estado interno).
  if (!ONLINE_INFERENCE_ENABLED) return { prob: null, status: "off" };
  return result;
}
