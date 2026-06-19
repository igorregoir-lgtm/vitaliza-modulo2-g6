"use client";

// ============================================================================
// Painel-guia da Trilha. Montado no AppShell; aparece em QUALQUER tela quando
// há `?trilha=<id>` na URL. Sobrepõe objetivo + instrução + tutor + "Concluir
// missão" sobre a tela real, sem recriá-la (ADR-0015). Recolhível; scaffolding
// decrescente (missões iniciais mostram a instrução por extenso).
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §2, §6.
// ============================================================================

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, MessageCircleQuestion, ArrowRight, X, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTutor } from "@/components/tutor/tutor-provider";
import { getMission, TRILHA_TOTAL } from "@/lib/trilha/missions";
import { useTrilhaProgress } from "./use-trilha-progress";
import { StationCheck } from "./station-check";

export function GuideRail() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tutor = useTutor();
  const { markComplete } = useTrilhaProgress();

  const missionId = params.get("trilha") ?? "";
  const mission = getMission(missionId);

  const [mode, setMode] = React.useState<"guide" | "check">("guide");
  const [collapsed, setCollapsed] = React.useState(false);
  const [showInstruction, setShowInstruction] = React.useState(true);

  // Reseta o estado ao trocar de missão (mudança de URL) ajustando o estado
  // DURANTE a renderização — mesmo padrão do live-simulator.tsx (evita o
  // setState-em-efeito que dispara renders em cascata).
  const [prevMissionId, setPrevMissionId] = React.useState<string | null>(null);
  if (prevMissionId !== missionId) {
    setPrevMissionId(missionId);
    setMode("guide");
    setCollapsed(false);
    setShowInstruction((mission?.order ?? 9) <= 2);
  }

  if (!mission) return null;

  function leaveTrilha() {
    router.replace(pathname);
  }

  function handleComplete() {
    markComplete(mission!.id);
    router.push("/trilha");
  }

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-30 px-3 pb-3 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto mx-auto max-w-4xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--accent)]/40 bg-[var(--paper)] shadow-[0_-6px_28px_-12px_rgba(14,31,48,0.35)]",
          "pr-0 sm:pr-20", // espaço para o botão flutuante do tutor (bottom-right)
        )}
      >
        {/* Cabeçalho do painel */}
        <div className="flex items-center gap-2 bg-[var(--ink)] px-3.5 py-2 text-[var(--paper)]">
          <Map className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <p className="min-w-0 flex-1 truncate text-xs font-semibold tracking-tight">
            <span className="text-[var(--accent)]">Trilha · missão {mission.order}/{TRILHA_TOTAL}</span>
            <span className="mx-1.5 text-[var(--steel-soft)]">·</span>
            <span>{mission.verb}</span>
          </p>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir painel da trilha" : "Recolher painel da trilha"}
            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={leaveTrilha}
            aria-label="Sair da trilha"
            title="Sair da trilha"
            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!collapsed && (
          <div className="max-h-[46vh] overflow-y-auto px-4 py-3">
            {mode === "guide" ? (
              <div className="flex flex-col gap-2.5">
                <div>
                  <p className="font-display text-base font-semibold text-[var(--ink)]">{mission.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--steel)]">{mission.objective}</p>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-3">
                  <button
                    type="button"
                    onClick={() => setShowInstruction((s) => !s)}
                    aria-expanded={showInstruction}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span className="eyebrow text-[var(--accent-deep)]">O que fazer aqui</span>
                    {showInstruction ? (
                      <ChevronUp className="h-3.5 w-3.5 text-[var(--steel)]" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--steel)]" />
                    )}
                  </button>
                  {showInstruction && (
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{mission.instruction}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="accent" size="sm" onClick={() => setMode("check")}>
                    Concluir missão
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => tutor.open({ question: mission.tutorSeed })}
                  >
                    <MessageCircleQuestion className="h-4 w-4" />
                    Pergunte ao tutor
                  </Button>
                  {mission.deepenHref && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={mission.deepenHref}>Aprofundar</a>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <StationCheck mission={mission} onComplete={handleComplete} onCancel={() => setMode("guide")} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
