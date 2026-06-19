"use client";

// ============================================================================
// Capstone (#6) — resumo executivo da Trilha, gerado pelo agente a partir das
// missões concluídas. Imprimível (window.print() + @media print). Degrada para
// o resumo determinístico do servidor quando não há IA.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §6.
// ============================================================================

import * as React from "react";
import { Loader2, Printer, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MISSIONS, TRILHA_TOTAL } from "@/lib/trilha/missions";
import { useTrilhaProgress } from "./use-trilha-progress";

/** Rede de segurança: limpa marcação markdown caso o LLM ignore a instrução. */
function cleanMarkdown(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*-{3,}\s*$/.test(line)) // linhas de regra horizontal
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s*/, "") // títulos #
        .replace(/^\s*[-*]\s+/, "• ") // bullets
        .replace(/\*\*(.+?)\*\*/g, "$1") // negrito
        .replace(/(?<!\*)\*(?!\*)(.+?)\*/g, "$1"), // itálico
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function ExecutiveSummary() {
  const { completed, hydrated } = useTrilhaProgress();
  const [summary, setSummary] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [source, setSource] = React.useState<"llm" | "fallback" | null>(null);

  const highlights = React.useMemo(
    () => MISSIONS.filter((m) => completed.includes(m.id)).map((m) => m.title),
    [completed],
  );

  const generate = React.useCallback(async () => {
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch("/api/trilha-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlights }),
      });
      const data = (await res.json()) as { summary?: string; source?: "llm" | "fallback" };
      setSummary(data.summary ? cleanMarkdown(data.summary) : "");
      setSource(data.source ?? null);
    } catch {
      setSummary("");
      setSource("fallback");
    } finally {
      setLoading(false);
    }
  }, [highlights]);

  // Auto-gera uma vez, após hidratar (microtask, para não chamar setState
  // sincronamente no efeito — padrão do individual-view.tsx).
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hydrated || startedRef.current) return;
    startedRef.current = true;
    void Promise.resolve().then(() => generate());
  }, [hydrated, generate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--steel)]">
          {hydrated ? completed.length : 0} de {TRILHA_TOTAL} missões concluídas.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Gerar novamente
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => window.print()}
            disabled={loading || !summary}
          >
            <Printer className="h-4 w-4" />
            Imprimir / salvar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-2.5 border-b border-[var(--rule)] pb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent-deep)]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Resumo executivo</p>
              <p className="font-display text-lg font-semibold text-[var(--ink)]">
                Estratégia de retenção orientada por dados
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
              <p className="text-sm text-[var(--steel)]">Sintetizando sua jornada…</p>
            </div>
          )}

          {!loading && summary && (
            <>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-soft)]">
                {summary}
              </p>
              {source === "fallback" && (
                <p className="no-print mt-4 text-[11px] text-[var(--steel-soft)]">
                  Resumo gerado localmente (sem IA disponível no momento).
                </p>
              )}
            </>
          )}

          {!loading && !summary && (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-sm text-[var(--steel)]">Não foi possível gerar o resumo.</p>
              <Button variant="accent" size="sm" onClick={generate}>
                <RefreshCw className="h-4 w-4" />
                Tentar de novo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {hydrated && completed.length < TRILHA_TOTAL && (
        <Badge variant="muted" className="no-print w-fit">
          Dica: conclua todas as missões para uma síntese mais completa.
        </Badge>
      )}
    </div>
  );
}
