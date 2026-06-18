"use client";

import * as React from "react";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TutorIcon } from "@/components/icons/tutor-icon";
import { TutorInline } from "@/components/tutor/tutor-inline";

interface AprenderCardProps {
  /** Mantidos para compatibilidade com as chamadas existentes. */
  screen: string;
  title: string;
  what?: string;
  why?: string;
  bullets?: string[];
  defaultOpen?: boolean;
  /** Linha curta de tease (ex.: convida a usar o simulador vivo). */
  tease?: string;
}

/** Card "Aprender · PBL": ao clicar, abre SOMENTE o chat inline do tutor
 *  (no fluxo da página) — sem painel estático separado. */
export function AprenderCard({ title, tease }: AprenderCardProps) {
  const [showInline, setShowInline] = React.useState(false);
  const seedQuestion = `Explique de forma simples a tela "${title}": o que ela faz e por que ela importa para reduzir cancelamentos.`;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper-soft)]">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        {/* Área clicável (abre o inline) */}
        <button
          type="button"
          onClick={() => setShowInline((v) => !v)}
          aria-expanded={showInline}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent-deep)]">
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="eyebrow">Aprender · PBL</span>
            <span className="truncate text-sm font-semibold text-[var(--ink)]">{title}</span>
            {tease && (
              <span className="mt-0.5 truncate text-xs text-[var(--steel)]">{tease}</span>
            )}
          </span>
        </button>

        {/* CTA — abre/fecha o chat INLINE */}
        <button
          type="button"
          onClick={() => setShowInline((v) => !v)}
          aria-expanded={showInline}
          aria-label={showInline ? "Fechar o tutor" : "O Tutor Explica"}
          className={cn(
            "group relative inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-md)] px-3.5 py-2",
            "bg-[var(--accent)] text-white text-[11px] font-semibold uppercase tracking-[0.12em]",
            "shadow-[0_4px_16px_-3px_rgba(20,184,166,0.5)] ring-1 ring-inset ring-white/15",
            "transition-all duration-200 hover:bg-[var(--accent-deep)] hover:shadow-[0_6px_22px_-3px_rgba(20,184,166,0.6)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper-soft)]",
            "active:translate-y-px",
          )}
        >
          <TutorIcon className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline">{showInline ? "Fechar tutor" : "O Tutor Explica"}</span>
          <span className="sm:hidden">Tutor</span>
          {!showInline && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--accent)] ring-2 ring-[var(--paper-soft)]" />
            </span>
          )}
        </button>
      </div>

      {/* Chat INLINE do tutor (no fluxo do card) */}
      {showInline && (
        <div className="border-t border-[var(--rule)] px-4 pb-4 pt-1">
          <TutorInline seedQuestion={seedQuestion} onClose={() => setShowInline(false)} />
        </div>
      )}
    </div>
  );
}
