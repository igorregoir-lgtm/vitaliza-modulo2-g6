"use client";

// ============================================================================
// Optimizer hint — banner da alavanca mais barata p/ baixar um tier.
// See docs/superpowers/specs/2026-06-17-simulador-vivo-design.md §3 (item 3),
// §7 (algoritmo) e §10. Reusa findCheapestLever; quando null por não-intrusão
// (sleeping_dog / proactive_allowed=false), mostra o banner de não-intrusão no
// estilo do SleepingDogBanner de individual-view.tsx; quando null por já ser
// 'baixo' ou sem solução no range, texto adequado. Sem marca, sentence case.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { Lightbulb, ShieldAlert, CircleCheck } from "lucide-react";
import { findCheapestLever } from "@/lib/simulator/engine";
import { predictHeuristic, tierFromProb } from "@/lib/heuristic";
import { TIER_LABELS } from "@/lib/labels";
import { TierBadge } from "@/components/tier-badge";
import { Button } from "@/components/ui/button";
import type { CustomerFeatures } from "@/lib/types";

export interface OptimizerHintProps {
  /** Original member features (não os overrides — o otimizador parte do real). */
  features: CustomerFeatures;
  /** Real XGBoost score (pred.churn_probability). */
  realProb: number;
  /** Aplica a sugestão (seta o override da alavanca no simulador). */
  onApply?: (feature: keyof CustomerFeatures, value: number) => void;
}

export function OptimizerHint({ features, realProb, onApply }: OptimizerHintProps) {
  const suggestion = React.useMemo(
    () => findCheapestLever(features, realProb),
    [features, realProb],
  );

  // Re-derive WHY findCheapestLever returned null to pick the right message.
  const basePred = React.useMemo(
    () => predictHeuristic("opt-base", features),
    [features],
  );
  const nonIntrusive =
    basePred.archetype === "sleeping_dog" || basePred.proactive_allowed === false;
  const alreadyLow = tierFromProb(realProb) === "baixo";

  if (suggestion) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[var(--accent-light)]/30 p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-deep)]" />
          <div className="flex flex-col gap-2">
            <div>
              <p className="eyebrow text-[var(--accent-deep)]">
                Alavanca mais barata
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Para baixar de{" "}
                <TierBadge tier={suggestion.fromTier} /> para{" "}
                <TierBadge tier={suggestion.toTier} />, a menor mudança é{" "}
                <span className="font-medium text-[var(--ink)]">
                  {suggestion.humanAction}
                </span>
                .
              </p>
              <p className="mt-1 text-xs text-[var(--steel)]">
                Projeção: {Math.round(suggestion.projected * 100)}% de risco (tier{" "}
                {TIER_LABELS[suggestion.toTier].toLowerCase()}).
              </p>
            </div>
            {onApply && (
              <Button
                variant="accent"
                size="sm"
                className="w-fit"
                onClick={() => onApply(suggestion.feature, suggestion.toValue)}
              >
                Aplicar no simulador
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // null por não-intrusão → banner no estilo do SleepingDogBanner.
  if (nonIntrusive) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--tier-medio)] bg-[#fbf3df] p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6d1f]" />
          <div>
            <p className="text-sm font-semibold text-[#8a6d1f]">
              Não acorde o cão que dorme — sem ação proativa
            </p>
            <p className="mt-1 text-sm text-[#7a611c]">
              Este perfil está excluído de campanhas proativas, então o otimizador
              não sugere alavancas. A simulação continua disponível para estudo.
            </p>
            <Link
              href="/principios-de-personalizacao"
              className="mt-2 inline-block text-xs font-medium text-[var(--accent-deep)] underline-offset-2 hover:underline"
            >
              Ver política de não-intrusão
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // null por já ser 'baixo'.
  if (alreadyLow) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tier-baixo)]" />
          <div>
            <p className="text-sm font-medium text-[var(--ink-soft)]">
              Risco já está no tier baixo
            </p>
            <p className="mt-1 text-sm text-[var(--steel)]">
              Não há tier abaixo para mirar — o otimizador não sugere intervenção.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // null por nenhuma alavanca isolada baixar o tier no range.
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--steel)]" />
        <div>
          <p className="text-sm font-medium text-[var(--ink-soft)]">
            Nenhuma alavanca isolada baixa o tier
          </p>
          <p className="mt-1 text-sm text-[var(--steel)]">
            Dentro do range de cada controle, nenhuma mudança única cruza para um
            tier menor. Combine alavancas no simulador para explorar o efeito.
          </p>
        </div>
      </div>
    </div>
  );
}
