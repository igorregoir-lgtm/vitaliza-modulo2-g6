"use client";

// ============================================================================
// Curva de calibração (#4) — diagrama de confiabilidade: prob. prevista (eixo X)
// × frequência real observada (eixo Y). A diagonal é o "perfeito". Brier score
// resume o erro. Pergunta-guia: "quando o modelo diz 70%, ~70% cancelam?"
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §6, §8.
// ============================================================================

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import { pct } from "@/lib/utils";
import { calibrationBins, brierScore } from "@/lib/trilha/calibration";
import type { Point } from "@/lib/trilha/threshold";

const tooltipStyle = {
  background: "#fafafa",
  border: "1px solid #d8dde3",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "var(--font-jetbrains), monospace",
};

export function CalibrationCurve({ points, nBins = 10 }: { points: Point[]; nBins?: number }) {
  const bins = React.useMemo(() => calibrationBins(points, nBins), [points, nBins]);
  const brier = React.useMemo(() => brierScore(points), [points]);

  const data = bins
    .filter((b) => b.count > 0)
    .map((b) => ({ predicted: Number(b.predicted.toFixed(3)), observed: Number(b.observed.toFixed(3)), ideal: Number(b.predicted.toFixed(3)), count: b.count }));

  if (points.length === 0 || data.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--rule)] bg-[var(--paper-soft)] px-6 py-10 text-center text-sm text-[var(--steel)]">
        Sem rótulos reais (p, y) para avaliar a calibração. Popule a base no Supabase.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Brier score" value={brier.toFixed(3)} hint="0 = perfeito · menor é melhor" accent={brier <= 0.2} />
        <Metric label="Amostras avaliadas" value={String(points.length)} hint={`${data.length} faixas com dados`} />
      </div>

      <ChartFrame
        title="Diagrama de confiabilidade"
        subtitle="Pontos sobre a diagonal = modelo bem calibrado (a confiança bate com a realidade)."
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8dde3" vertical={false} />
            <XAxis
              dataKey="predicted"
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tickLine={false}
              axisLine={{ stroke: "#d8dde3" }}
              label={{ value: "previsto", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "#5b7691" }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => `Previsto ~${Math.round(Number(v) * 100)}%`}
              formatter={(v, name) => [pct(Number(v), 0), name === "observed" ? "Observado" : "Perfeito"]}
            />
            <Line type="linear" dataKey="ideal" stroke="#8a9aab" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Line type="monotone" dataKey="observed" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3, fill: "#14b8a6" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <p className="text-[11px] leading-relaxed text-[var(--steel)]">
        Leitura: acima da diagonal, o modelo subestima o risco naquela faixa; abaixo, superestima.
        Isso mede a confiança das previsões — não a causalidade das variáveis.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper)] p-3">
      <p className="eyebrow mb-1">{label}</p>
      <p className="mono text-lg font-semibold" style={{ color: accent ? "var(--accent-deep)" : "var(--ink)" }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-[var(--steel)]">{hint}</p>}
    </div>
  );
}
