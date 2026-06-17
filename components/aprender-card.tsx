"use client";

import * as React from "react";
import { GraduationCap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TutorIcon } from "@/components/icons/tutor-icon";
import { useTutor } from "@/components/tutor/tutor-provider";

interface AprenderCardProps {
  /** Short concept id / screen name (mantido para contexto/compatibilidade). */
  screen: string;
  title: string;
  /** Static "what & why" content (always available, no LLM needed). */
  what: string;
  why: string;
  /** Optional extra bullets (e.g. theory references). */
  bullets?: string[];
  defaultOpen?: boolean;
}

export function AprenderCard({ title, what, why, bullets, defaultOpen = false }: AprenderCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const tutor = useTutor();

  const askTutor = () =>
    tutor.open({
      question: `Sobre a tela "${title}": o que ela faz e por que ela importa para reduzir cancelamentos? Explique de forma simples.`,
    });

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper-soft)]">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        {/* Toggle area */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent-deep)]">
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="eyebrow">Aprender · PBL</span>
            <span className="truncate text-sm font-semibold text-[var(--ink)]">{title}</span>
          </span>
        </button>

        {/* CTA do tutor (abre o chat conversacional) */}
        <button
          type="button"
          onClick={askTutor}
          aria-label="Perguntar ao tutor"
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
          <span className="hidden sm:inline">Perguntar ao tutor</span>
          <span className="sm:hidden">Tutor</span>
          <span className="absolute -right-1 -top-1 flex h-3 w-3" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--accent)] ring-2 ring-[var(--paper-soft)]" />
          </span>
        </button>

        {/* Expand chevron */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Recolher" : "Expandir"}
          className="shrink-0 rounded-full p-1 text-[var(--steel)] transition-colors hover:bg-[var(--cloud)] hover:text-[var(--ink)]"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--rule)] px-4 py-4 text-sm leading-relaxed text-[var(--ink-soft)]">
          <p className="mb-2">
            <span className="font-semibold text-[var(--ink)]">O que faz: </span>
            {what}
          </p>
          <p className="mb-2">
            <span className="font-semibold text-[var(--ink)]">Por que existe: </span>
            {why}
          </p>
          {bullets && bullets.length > 0 && (
            <ul className="mb-1 ml-4 list-disc space-y-1 text-[var(--steel)]">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={askTutor}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-deep)] hover:underline"
          >
            <TutorIcon className="h-3.5 w-3.5" /> Conversar com o tutor sobre isto
          </button>
        </div>
      )}
    </div>
  );
}
