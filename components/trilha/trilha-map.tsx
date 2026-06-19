"use client";

// ============================================================================
// Capa / mapa da Trilha — os 6 degraus de Bloom, com progresso (localStorage),
// CTA de tour e reinício. Cada degrau abre a tela real com ?trilha=<id>.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §6.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, RotateCcw, Compass, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MISSIONS, TRILHA_TOTAL, TRILHA_EST_MIN, type Mission } from "@/lib/trilha/missions";
import { useTrilhaProgress } from "./use-trilha-progress";

export function TrilhaMap() {
  const { isComplete, reset, pct, hydrated, completed } = useTrilhaProgress();
  const [confirmReset, setConfirmReset] = React.useState(false);

  const firstIncomplete = MISSIONS.find((m) => !isComplete(m.id)) ?? MISSIONS[0];
  const allDone = hydrated && completed.length === TRILHA_TOTAL;
  const tourLabel = !hydrated
    ? "Começar a trilha"
    : completed.length === 0
      ? `Fazer o tour guiado (~${TRILHA_EST_MIN} min)`
      : allDone
        ? "Revisar a trilha"
        : "Continuar de onde parei";

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho editorial */}
      <div>
        <p className="eyebrow mb-1">Aprender fazendo · PBL</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
          Trilha de Aprendizado
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--steel)]">
          Uma jornada guiada pelas telas reais do sistema — do problema do churn até desenhar e
          comunicar uma estratégia de retenção.
        </p>
      </div>

      {/* HERO — como percorrer (os dois modos, em destaque) */}
      <section aria-label="Como percorrer a trilha">
        <p className="eyebrow mb-3 text-[var(--steel)]">Escolha como percorrer</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 1) Tour guiado — cartão-CTA primário (clicável) */}
          <Link
            href={allDone ? MISSIONS[0].href : firstIncomplete.href}
            className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border-2 border-[var(--accent)] bg-[var(--accent-light)]/60 p-5 transition-all hover:bg-[var(--accent-light)] hover:shadow-[0_14px_34px_-14px_rgba(20,184,166,0.6)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
          >
            <span className="absolute right-4 top-4 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              Recomendado
            </span>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white shadow-[0_6px_18px_-6px_rgba(20,184,166,0.85)]">
                <Compass className="h-6 w-6" />
              </span>
              <div>
                <p className="eyebrow text-[var(--accent-deep)]">Opção 1</p>
                <p className="font-display text-xl font-semibold leading-tight text-[var(--ink)]">
                  Tour guiado{" "}
                  <span className="text-sm font-normal text-[var(--steel)]">· ~{TRILHA_EST_MIN} min</span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              Siga as 6 missões em ordem. Em cada tela, o painel-guia mostra exatamente o que fazer e
              fecha com um check rápido. O caminho mais rápido e completo.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-deep)]">
              {tourLabel}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          {/* 2) Aprofundar — cartão explicativo (claro, alto contraste) */}
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper)] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-light)] text-[var(--accent-deep)]">
                <Layers className="h-6 w-6" />
              </span>
              <div>
                <p className="eyebrow text-[var(--accent-deep)]">Opção 2</p>
                <p className="font-display text-xl font-semibold leading-tight text-[var(--ink)]">
                  Aprofundar <span className="text-sm font-normal text-[var(--steel)]">· livre</span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              Em qualquer missão, toque em{" "}
              <span className="rounded bg-[var(--accent-light)] px-1.5 py-0.5 font-semibold text-[var(--accent-deep)]">Aprofundar</span>{" "}
              para explorar o tema sem roteiro, e{" "}
              <span className="rounded bg-[var(--accent-light)] px-1.5 py-0.5 font-semibold text-[var(--accent-deep)]">Pergunte ao tutor</span>{" "}
              para ir fundo nos porquês.
            </p>
            <p className="mt-auto pt-3 text-xs text-[var(--steel)]">
              Cada degrau abaixo aponta o que explorar mais a fundo (↳ Aprofundar).
            </p>
          </div>
        </div>
      </section>

      {/* Progresso — barra prominente (o tour é o cartão acima) */}
      <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Seu progresso</p>
          <p className="mono text-xs font-semibold text-[var(--ink)]">
            {hydrated ? completed.length : 0} / {TRILHA_TOTAL} missões
          </p>
        </div>
        <Progress
          value={hydrated ? pct : 0}
          aria-label={`Progresso da trilha: ${hydrated ? completed.length : 0} de ${TRILHA_TOTAL} missões`}
        />
        <p className="text-[11px] text-[var(--steel)]">Vale para esta visita — zera ao fechar a aba.</p>
      </div>

      {/* Degraus */}
      <ol className="flex flex-col gap-3">
        {MISSIONS.map((m) => (
          <MissionRow
            key={m.id}
            mission={m}
            done={hydrated && isComplete(m.id)}
            current={hydrated && firstIncomplete.id === m.id && !allDone}
          />
        ))}
      </ol>

      {/* Reiniciar */}
      <div className="flex items-center justify-end gap-2 border-t border-[var(--rule)] pt-4">
        {confirmReset ? (
          <>
            <span className="text-xs text-[var(--steel)]">Apagar todo o progresso?</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                reset();
                setConfirmReset(false);
              }}
            >
              Sim, reiniciar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmReset(true)}
            disabled={!hydrated || completed.length === 0}
          >
            <RotateCcw className="h-4 w-4" />
            Reiniciar trilha
          </Button>
        )}
      </div>
    </div>
  );
}

function MissionRow({
  mission,
  done,
  current,
}: {
  mission: Mission;
  done: boolean;
  current: boolean;
}) {
  const cta = done ? "Revisar" : current ? "Continuar" : "Começar";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-[var(--paper)] p-4 transition-colors sm:flex-row sm:items-center",
        current ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "border-[var(--rule)]",
      )}
    >
      {/* Status + número */}
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            done
              ? "bg-[var(--accent-light)] text-[var(--accent-deep)]"
              : current
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--cloud)] text-[var(--steel)]",
          )}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : <span className="mono text-sm font-semibold">{mission.order}</span>}
        </span>
      </div>

      {/* Texto */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-[var(--steel)]">{mission.bloom}</span>
          {current && (
            <Badge variant="muted" className="gap-1 text-[var(--accent-deep)]">
              <Sparkles className="h-3 w-3" /> você está aqui
            </Badge>
          )}
          {done && <Badge variant="outline">concluída</Badge>}
        </div>
        <p className="mt-0.5 truncate font-semibold text-[var(--ink)]">{mission.title}</p>
        <p className="text-sm text-[var(--steel)]">{mission.objective}</p>
        {mission.deepenHint && (
          <p className="mt-1 text-xs text-[var(--steel-soft)]">↳ Aprofundar: {mission.deepenHint}</p>
        )}
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center gap-2">
        {mission.deepenHref && (
          <Button variant="ghost" size="sm" asChild title={mission.deepenHint}>
            <a href={mission.deepenHref}>Aprofundar</a>
          </Button>
        )}
        <Button variant={current ? "accent" : "outline"} size="sm" asChild>
          <Link href={mission.href}>
            {done ? <Circle className="h-3.5 w-3.5" /> : null}
            {cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </li>
  );
}
