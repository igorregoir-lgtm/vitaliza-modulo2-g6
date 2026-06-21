"use client";

// ============================================================================
// Projection readout — "Atual · XGBoost" vs "Projeção · simulação".
// See docs/superpowers/specs/2026-06-17-simulador-vivo-design.md §3 (item 1),
// §2 (ancoragem honesta) e §10 (arredondar p.p. inteiro, prob em %).
// Reusa apenas tokens de app/globals.css. Sentence case, sem marca.
// ============================================================================

import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

/** Round a probability to a whole-percent string. */
function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export interface ProjectionReadoutProps {
  /** Real XGBoost score (pred.churn_probability). */
  realProb: number;
  /** Projeção exibida (ONNX real ou heurística ancorada). */
  projected: number;
  /** Math.round((projected - realProb) * 100). */
  deltaPP: number;
  /** Fonte da projeção — 'onnx' = XGBoost real; 'heuristic' = surrogate ancorado. */
  source?: "onnx" | "heuristic";
}

export function ProjectionReadout({
  realProb,
  projected,
  deltaPP,
  source = "heuristic",
}: ProjectionReadoutProps) {
  const onnx = source === "onnx";
  const magnitude = Math.abs(deltaPP);
  // Para risco de churn, queda (deltaPP < 0) é bom → cor de tier baixo.
  const deltaColor =
    deltaPP < 0
      ? "var(--tier-baixo)"
      : deltaPP > 0
        ? "var(--tier-critico)"
        : "var(--steel)";
  const DeltaIcon = deltaPP < 0 ? ArrowDown : deltaPP > 0 ? ArrowUp : Minus;
  const deltaLabel =
    deltaPP === 0
      ? "sem mudança"
      : `${deltaPP < 0 ? "−" : "+"}${magnitude} p.p.`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <ReadoutCell
          eyebrow="Atual · XGBoost"
          value={pct(realProb)}
          hint="score real do membro"
        />
        <div className="flex items-center justify-center">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
            style={{ color: deltaColor }}
            aria-label={`Variação ${deltaLabel}`}
          >
            <DeltaIcon className="h-4 w-4" />
            {deltaLabel}
          </div>
        </div>
        <ReadoutCell
          eyebrow={onnx ? "Projeção · XGBoost real" : "Projeção · simulação"}
          value={pct(projected)}
          hint={onnx ? "inferência real via ONNX" : "modelo transparente, ancorado no score real"}
          emphasis
        />
      </div>

      <p className="text-xs leading-relaxed text-[var(--steel)]">
        {onnx
          ? "Projeção = XGBoost real recalculado (ONNX) para a versão simulada. O waterfall SHAP ao lado segue o modelo transparente (híbrido). Descreve o comportamento do modelo — não causalidade."
          : "Projeção pelo modelo transparente auditável, ancorada no score real do XGBoost. Descreve o comportamento do modelo — não causalidade."}
      </p>
    </div>
  );
}

function ReadoutCell({
  eyebrow,
  value,
  hint,
  emphasis,
}: {
  eyebrow: string;
  value: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border p-4 ${
        emphasis
          ? "border-[var(--accent-light)] bg-[var(--accent-light)]/30"
          : "border-[var(--rule)] bg-[var(--paper-soft)]"
      }`}
    >
      <span className="eyebrow">{eyebrow}</span>
      <span
        className="mono text-3xl font-semibold leading-none"
        style={{ color: emphasis ? "var(--accent-deep)" : "var(--ink)" }}
      >
        {value}
      </span>
      <span className="text-center text-[10px] text-[var(--steel-soft)]">{hint}</span>
    </div>
  );
}
