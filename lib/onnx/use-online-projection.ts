"use client";

// ============================================================================
// useOnlineProjection — wire OPCIONAL da inferência REAL (XGBoost via ONNX) no
// Simulador Vivo. Atrás da flag NEXT_PUBLIC_ONLINE_INFERENCE (desligada por
// padrão). Ver ADR-0017 e docs de inferência online.
//
// Ligada: busca a probabilidade real do XGBoost (rota /api/infer-onnx) para
// {...features, ...overrideDelta} e a devolve ao simulador, que a usa como
// "Projeção" no lugar da heurística ancorada. SHAP/arquétipo seguem no surrogate
// transparente (HÍBRIDO — score real + explicação surrogate).
//
// Fail-safe por construção: flag off OU qualquer erro/indisponibilidade → prob:null
// → o simulador mantém a heurística ancorada (comportamento atual; produção intacta).
// Corrida resolvida por id incremental (só a última resposta vale) + AbortController.
// ============================================================================

import * as React from "react";
import type { CustomerFeatures } from "@/lib/types";

/** Flag pública (inlined em build). "1" ou "true" liga; ausência = desligada. */
export const ONLINE_INFERENCE_ENABLED =
  process.env.NEXT_PUBLIC_ONLINE_INFERENCE === "1" ||
  process.env.NEXT_PUBLIC_ONLINE_INFERENCE === "true";

export type OnlineStatus = "off" | "loading" | "ok" | "error";

export interface OnlineProjection {
  /** Prob. real do XGBoost p/ as features mescladas, ou null quando indisponível. */
  prob: number | null;
  /** 'off' = flag desligada; senão o estado da última chamada. */
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
    // Desligada ou sem intervenção: nada a buscar (em repouso a projeção é o score real).
    if (!ONLINE_INFERENCE_ENABLED || !hasDelta) return;
    const id = ++reqId.current;
    const merged = { ...features, ...overrideDelta };
    const ctrl = new AbortController();
    fetch("/api/infer-onnx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { churn_probability?: number }) => {
        if (id !== reqId.current) return; // resposta obsoleta
        const p = Number(d?.churn_probability);
        setResult(
          Number.isFinite(p) ? { prob: p, status: "ok" } : { prob: null, status: "error" },
        );
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return; // cancelada
        setResult({ prob: null, status: "error" });
      });
    return () => ctrl.abort();
  }, [features, overrideDelta, hasDelta]);

  // Curto-circuito explícito quando desligada (não importa o estado interno).
  if (!ONLINE_INFERENCE_ENABLED) return { prob: null, status: "off" };
  return result;
}
