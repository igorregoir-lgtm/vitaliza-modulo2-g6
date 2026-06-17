"use client";

import * as React from "react";
import { GraduationCap, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AprenderCardProps {
  /** Short concept id / screen name passed to the tutor as context. */
  screen: string;
  title: string;
  /** Static "what & why" content (always available, no LLM needed). */
  what: string;
  why: string;
  /** Optional extra bullets (e.g. theory references). */
  bullets?: string[];
  defaultOpen?: boolean;
}

export function AprenderCard({
  screen,
  title,
  what,
  why,
  bullets,
  defaultOpen = false,
}: AprenderCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [tutorAnswer, setTutorAnswer] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const answerRef = React.useRef<HTMLDivElement>(null);

  async function askTutor() {
    setOpen(true);
    setLoading(true);
    setTutorAnswer(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "tutor",
          question: `Explique de forma simples e acolhedora a tela "${title}": o que ela faz e por que ela importa para reduzir cancelamentos.`,
          context: `Tela: ${screen}. O que faz: ${what} Por que existe: ${why}`,
        }),
      });
      const data = await res.json();
      setTutorAnswer(data.answer ?? "Não foi possível obter a explicação agora.");
    } catch {
      setTutorAnswer("Não foi possível falar com o tutor agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        answerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    }
  }

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

        {/* Prominent, always-visible Tutor CTA (allla teal) */}
        <button
          type="button"
          onClick={askTutor}
          disabled={loading}
          aria-label="Perguntar ao tutor"
          className={cn(
            "group relative inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-md)] px-3.5 py-2",
            "bg-[var(--accent)] text-white",
            "text-[11px] font-semibold uppercase tracking-[0.12em]",
            "shadow-[0_4px_16px_-3px_rgba(20,184,166,0.5)] ring-1 ring-inset ring-white/15",
            "transition-all duration-200 hover:bg-[var(--accent-deep)] hover:shadow-[0_6px_22px_-3px_rgba(20,184,166,0.6)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper-soft)]",
            "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
          )}
          <span className="hidden sm:inline">{loading ? "Pensando…" : "Perguntar ao tutor"}</span>
          <span className="sm:hidden">Tutor</span>
          {!loading && (
            <span
              className="absolute -right-1 -top-1 flex h-3 w-3"
              aria-hidden
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--accent)] ring-2 ring-[var(--paper-soft)]" />
            </span>
          )}
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

          {(loading || tutorAnswer) && (
            <div
              ref={answerRef}
              className="mt-4 rounded-[var(--radius-md)] border border-[var(--rule-soft)] border-l-2 border-l-[var(--accent)] bg-[var(--accent-light)]/35 p-3.5"
            >
              <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-[var(--accent-deep)]">
                <Sparkles className="h-3 w-3" /> Tutor
              </p>
              {loading ? (
                <p className="flex items-center gap-2 text-[var(--steel)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparando uma explicação acolhedora…
                </p>
              ) : (
                <p className="whitespace-pre-wrap text-[var(--ink-soft)]">{tutorAnswer}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
