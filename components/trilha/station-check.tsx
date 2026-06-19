"use client";

// ============================================================================
// Check formativo (predict-first / retrieval practice) ao fim de cada missão.
// Sem punição: o aprendiz pode concluir mesmo errando — o feedback é que ensina.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §6.
// ============================================================================

import * as React from "react";
import { Check, X, CircleHelp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Mission } from "@/lib/trilha/missions";

export function StationCheck({
  mission,
  onComplete,
  onCancel,
}: {
  mission: Mission;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = React.useState<number | null>(null);
  const revealed = chosen !== null;
  const { check } = mission;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent-deep)]">
          <CircleHelp className="h-4 w-4" />
        </span>
        <div>
          <p className="eyebrow text-[var(--accent-deep)]">Check · antes de ver, o que você acha?</p>
          <p className="mt-1 text-sm font-medium leading-snug text-[var(--ink)]">{check.prompt}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Opções do check">
        {check.options.map((opt, i) => {
          const isChosen = chosen === i;
          const showAsCorrect = revealed && opt.correct;
          const showAsWrongChosen = revealed && isChosen && !opt.correct;
          return (
            <li key={i}>
              <button
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={revealed}
                onClick={() => setChosen(i)}
                className={cn(
                  "w-full rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
                  !revealed &&
                    "border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)]/30",
                  showAsCorrect && "border-[var(--accent)] bg-[var(--accent-light)]/40 text-[var(--ink)]",
                  showAsWrongChosen && "border-[var(--tier-alto)] bg-[var(--tier-alto-bg)] text-[var(--tier-alto-text)]",
                  revealed && !opt.correct && !isChosen && "border-[var(--rule)] bg-[var(--paper)] text-[var(--steel)] opacity-70",
                )}
              >
                <span className="flex items-start gap-2">
                  {revealed && (
                    <span className="mt-0.5 shrink-0">
                      {opt.correct ? (
                        <Check className="h-4 w-4 text-[var(--accent-deep)]" />
                      ) : isChosen ? (
                        <X className="h-4 w-4 text-[var(--tier-alto)]" />
                      ) : (
                        <span className="inline-block h-4 w-4" />
                      )}
                    </span>
                  )}
                  <span className="flex flex-col gap-1">
                    <span>{opt.text}</span>
                    {revealed && (isChosen || opt.correct) && (
                      <span className="text-xs leading-relaxed text-[var(--steel)]">{opt.feedback}</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {revealed ? (
          <Button variant="accent" size="sm" onClick={onComplete}>
            Concluir e voltar à trilha
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <p className="text-xs text-[var(--steel)]">Escolha uma resposta para ver o feedback do tutor.</p>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Voltar à missão
        </Button>
      </div>
    </div>
  );
}
