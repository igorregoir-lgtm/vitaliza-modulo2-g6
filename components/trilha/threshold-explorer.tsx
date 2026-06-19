"use client";

// ============================================================================
// Explorador de threshold (#2) — mexa no corte e veja o trade-off recall ×
// falsos positivos × ROI ao vivo, sobre os pares (p,y) REAIS do modelo.
// Insight: o melhor corte é o que MAXIMIZA ROI, não o que maximiza recall.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §6, §7.
// ============================================================================

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ChartFrame } from "@/components/charts/chart-frame";
import { brl, pct } from "@/lib/utils";
import {
  evaluateThreshold,
  bestRoiCutoff,
  DEFAULT_COSTS,
  type Point,
} from "@/lib/trilha/threshold";

const tooltipStyle = {
  background: "#fafafa",
  border: "1px solid #d8dde3",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "var(--font-jetbrains), monospace",
};

export function ThresholdExplorer({
  points,
  defaultCutoff = 0.5,
}: {
  points: Point[];
  defaultCutoff?: number;
}) {
  const [cutoff, setCutoff] = React.useState(Math.round(defaultCutoff * 100) / 100);

  const result = React.useMemo(
    () => evaluateThreshold(points, cutoff, DEFAULT_COSTS),
    [points, cutoff],
  );
  const best = React.useMemo(() => bestRoiCutoff(points, DEFAULT_COSTS), [points]);

  // Varredura para o gráfico (independente do cutoff atual).
  const sweep = React.useMemo(() => {
    const steps = 51;
    return Array.from({ length: steps }, (_, i) => {
      const c = i / (steps - 1);
      const r = evaluateThreshold(points, c, DEFAULT_COSTS);
      return { cutoff: Number(c.toFixed(2)), recall: r.recall, precision: r.precision };
    });
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--rule)] bg-[var(--paper-soft)] px-6 py-10 text-center text-sm text-[var(--steel)]">
        Sem rótulos reais (p, y) para explorar. Popule a base no Supabase para ativar a estação.
      </div>
    );
  }

  const isOptimal = Math.abs(cutoff - best.cutoff) < 0.011;

  return (
    <div className="flex flex-col gap-5">
      {/* Slider de corte */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-[var(--ink-soft)]">Corte de decisão (threshold)</span>
          <span className="mono text-sm font-semibold text-[var(--ink)]">{pct(cutoff, 0)}</span>
        </div>
        <Slider
          value={[cutoff]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={(v) => setCutoff(v[0])}
          aria-label="Corte de decisão"
        />
        <p className="mt-1.5 text-xs text-[var(--steel)]">
          Membros com risco previsto ≥ {pct(cutoff, 0)} são marcados para intervenção
          ({result.flagged} de {points.length}).
        </p>
      </div>

      {/* Readouts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Recall (churns pegos)" value={pct(result.recall, 0)} hint={`${result.tp} de ${result.tp + result.fn}`} accent />
        <Metric label="Precisão" value={pct(result.precision, 0)} hint={`${result.tp} certos / ${result.flagged} contatados`} />
        <Metric label="Falsos positivos" value={String(result.fp)} hint="contatos desperdiçados" negative={result.fp > 0} />
        <Metric label="ROI estimado" value={brl(result.roi)} hint="benefício − custo" accent={result.roi >= 0} negative={result.roi < 0} />
      </div>

      {/* Curva recall × precisão com marcador do corte */}
      <ChartFrame
        title="Trade-off do corte"
        subtitle="Conforme o corte sobe, o recall cai e a precisão sobe. A linha vertical é o corte atual."
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={sweep} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8dde3" vertical={false} />
            <XAxis
              dataKey="cutoff"
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tickLine={false}
              axisLine={{ stroke: "#d8dde3" }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => `Corte ${Math.round(Number(v) * 100)}%`}
              formatter={(v, name) => [pct(Number(v), 0), name === "recall" ? "Recall" : "Precisão"]}
            />
            <ReferenceLine x={cutoff} stroke="#0e1f30" strokeDasharray="4 2" />
            <ReferenceLine x={best.cutoff} stroke="#14b8a6" strokeDasharray="2 2" />
            <Line type="monotone" dataKey="recall" stroke="#e07a3f" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="precision" stroke="#1e3a5f" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      {/* Ótimo de ROI */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[var(--accent-light)]/30 p-4">
        <p className="text-sm text-[var(--ink-soft)]">
          {isOptimal ? (
            <>Você está no corte de <span className="font-semibold text-[var(--accent-deep)]">ROI máximo</span> ({pct(best.cutoff, 0)} → {brl(best.roi)}).</>
          ) : (
            <>O corte que <span className="font-semibold text-[var(--accent-deep)]">maximiza o ROI</span> é {pct(best.cutoff, 0)} ({brl(best.roi)}) — não o que maximiza o recall.</>
          )}
        </p>
        {!isOptimal && (
          <Button variant="accent" size="sm" onClick={() => setCutoff(Math.round(best.cutoff * 100) / 100)}>
            <Sparkles className="h-4 w-4" />
            Ir para o corte de ROI máximo
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--steel)]">
        Premissas (explícitas): cada contato custa {brl(DEFAULT_COSTS.retentionCost)}; um churn evitado
        preserva {brl(DEFAULT_COSTS.churnLoss)} de LTV; {pct(DEFAULT_COSTS.saveRate, 0)} dos churners
        contatados são de fato retidos. ROI = TP × {pct(DEFAULT_COSTS.saveRate, 0)} × {brl(DEFAULT_COSTS.churnLoss)} − contatos × {brl(DEFAULT_COSTS.retentionCost)}.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper)] p-3">
      <p className="eyebrow mb-1">{label}</p>
      <p
        className="mono text-lg font-semibold"
        style={{ color: negative ? "var(--tier-critico)" : accent ? "var(--accent-deep)" : "var(--ink)" }}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-[var(--steel)]">{hint}</p>}
    </div>
  );
}
