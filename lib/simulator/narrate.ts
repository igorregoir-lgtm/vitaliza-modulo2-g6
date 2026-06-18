// ============================================================================
// Deterministic narration for the simulator (no LLM — §12 YAGNI).
// Builds a pt-BR sentence citing the biggest driver and its direction, ending
// with the honesty disclaimer. See spec §5.
// ============================================================================

export interface NarrationArgs {
  realProb: number;
  projected: number;
  /** Math.round((projected - realProb) * 100) */
  deltaPP: number;
  changedLevers: { label: string; toValue: number; unit?: string }[];
  topDriverLabel: string;
  topDriverDir: "up" | "down";
}

/** The honesty disclaimer required on every narration (§5, §2). */
export const NARRATION_DISCLAIMER =
  "Isto descreve o comportamento do modelo, não causalidade.";

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function formatValue(value: number, unit?: string): string {
  const n =
    Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

/**
 * Build the narration string. Always cites the top driver and its direction,
 * states the before→after move in plain language, and ends with the disclaimer.
 */
export function buildNarration(args: NarrationArgs): string {
  const { realProb, projected, deltaPP, changedLevers, topDriverLabel, topDriverDir } =
    args;

  const parts: string[] = [];

  // 1. What the user changed.
  if (changedLevers.length > 0) {
    const changes = changedLevers
      .map((l) => `${l.label} para ${formatValue(l.toValue, l.unit)}`)
      .join(" e ");
    parts.push(`Ao ajustar ${changes},`);
  } else {
    parts.push("Sem ajustes,");
  }

  // 2. Before → after on the score.
  parts.push(
    `o modelo move o risco de ${pct(realProb)} para ${pct(projected)}`,
  );

  // 3. Direction of the move in p.p.
  const magnitude = Math.abs(deltaPP);
  if (deltaPP < 0) {
    parts.push(`(queda de ${magnitude} p.p.).`);
  } else if (deltaPP > 0) {
    parts.push(`(alta de ${magnitude} p.p.).`);
  } else {
    parts.push("(sem mudança no risco).");
  }

  // 4. Cite the biggest driver and its direction.
  const dirPhrase =
    topDriverDir === "up"
      ? "empurrando o risco para cima"
      : "puxando o risco para baixo";
  parts.push(`O maior fator é ${topDriverLabel}, ${dirPhrase}.`);

  // 5. Honesty disclaimer.
  parts.push(NARRATION_DISCLAIMER);

  return parts.join(" ");
}
