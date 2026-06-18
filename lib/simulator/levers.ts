// ============================================================================
// Simulator levers — single source of truth for the actionable what-if knobs.
// See docs/superpowers/specs/2026-06-17-simulador-vivo-design.md §6.
// Pure metadata: pt-BR labels (sentence case), educational microcopy and a
// ready-to-show/narrate humanAction(value) per lever. No brand references.
// ============================================================================

import type { CustomerFeatures } from "../types";

export type LeverControl = "slider" | "toggle" | "select";

export interface LeverDef {
  /** Feature edited by this lever (must be actionable). */
  feature: keyof CustomerFeatures;
  /** pt-BR label, sentence case. */
  label: string;
  control: LeverControl;
  /** slider bounds */
  min?: number;
  max?: number;
  step?: number;
  /** select options */
  options?: number[];
  unit?: string;
  /** short educational explanation */
  microcopy: string;
  /** ready-to-display/narrate action phrase for a given value */
  humanAction: (value: number) => string;
}

/** Round a frequency to a friendly 1-decimal string for narration. */
function freq(value: number): string {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

export const LEVERS: LeverDef[] = [
  {
    feature: "Avg_class_frequency_current_month",
    label: "Frequência de aulas no mês",
    control: "slider",
    min: 0,
    max: 5,
    step: 0.1,
    unit: "aulas/sem",
    microcopy:
      "A alavanca mais forte: reengajar quem parou de aparecer recalcula o arquétipo ao vivo.",
    humanAction: (value) => `levar o membro a ~${freq(value)} aulas por semana`,
  },
  {
    feature: "Group_visits",
    label: "Participação em desafios em grupo",
    control: "toggle",
    microcopy:
      "Desafios em grupo criam hábito e vínculo social — um forte fator de retenção.",
    humanAction: (value) =>
      value >= 0.5
        ? "incluir o membro nos desafios em grupo"
        : "tirar o membro dos desafios em grupo",
  },
  {
    feature: "Contract_period",
    label: "Duração do plano",
    control: "select",
    options: [1, 3, 6, 12],
    unit: "meses",
    microcopy:
      "Planos mais longos elevam o custo de saída — facilitam reter quem está indeciso.",
    humanAction: (value) => `renovar para um plano de ${Math.round(value)} meses`,
  },
  {
    feature: "Month_to_end_contract",
    label: "Meses até o fim do contrato",
    control: "slider",
    min: 0,
    max: 12,
    step: 1,
    unit: "meses",
    microcopy:
      "Quanto mais perto do fim, maior o risco: trabalhar a renovação cedo reduz o churn.",
    humanAction: (value) =>
      `trabalhar a renovação (${Math.round(value)} meses até o fim)`,
  },
];
