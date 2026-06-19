"use client";

// ============================================================================
// Capa / mapa da Trilha — os 6 degraus de Bloom, com progresso (localStorage),
// CTA de tour e reinício. Cada degrau abre a tela real com ?trilha=<id>.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §6.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, RotateCcw, Compass, Sparkles } from "lucide-react";
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
      <div className="border-b border-[var(--rule)] pb-5">
        <p className="eyebrow mb-1">Aprender fazendo · PBL</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
          Trilha de Aprendizado
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--steel)]">
          Uma jornada guiada pelas telas reais do sistema — de entender o problema do churn até
          desenhar e comunicar uma estratégia de retenção. Cada missão termina com um check rápido;
          seu progresso vale para esta visita e zera ao fechar a aba.
        </p>

        {/* Duas formas de percorrer — deixa explícito o modo aprofundado */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-3">
            <p className="eyebrow text-[var(--accent-deep)]">1 · Tour guiado (~{TRILHA_EST_MIN} min)</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--steel)]">
              Siga as missões em ordem. Em cada tela, o painel-guia diz o que fazer e fecha com um
              check. É o caminho rápido e completo.
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-3">
            <p className="eyebrow text-[var(--accent-deep)]">2 · Aprofundar (livre)</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--steel)]">
              Em qualquer missão, use <span className="font-medium text-[var(--ink)]">Aprofundar</span>{" "}
              para explorar o tema sem roteiro, e <span className="font-medium text-[var(--ink)]">Pergunte
              ao tutor</span> (no painel-guia) para ir fundo nos porquês.
            </p>
          </div>
        </div>
      </div>

      {/* Progresso + CTA de tour */}
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Progresso</p>
            <p className="mono text-xs text-[var(--steel)]">
              {hydrated ? completed.length : 0} de {TRILHA_TOTAL} missões
            </p>
          </div>
          <Progress
            value={hydrated ? pct : 0}
            aria-label={`Progresso da trilha: ${hydrated ? completed.length : 0} de ${TRILHA_TOTAL} missões`}
            className="mt-2"
          />
        </div>
        <Button variant="accent" asChild className="shrink-0">
          <Link href={allDone ? MISSIONS[0].href : firstIncomplete.href}>
            <Compass className="h-4 w-4" />
            {tourLabel}
          </Link>
        </Button>
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
