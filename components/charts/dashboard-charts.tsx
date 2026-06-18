"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "./chart-frame";
import { pct } from "@/lib/utils";
import { TIER_LABELS } from "@/lib/labels";
import type { CohortStatsResult, RiskTier } from "@/lib/types";

const TIER_FILL: Record<RiskTier, string> = {
  baixo: "#14b8a6",
  medio: "#d9a441",
  alto: "#e07a3f",
  critico: "#c0463b",
};

const tooltipStyle = {
  background: "#fafafa",
  border: "1px solid #d8dde3",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "var(--font-jetbrains), monospace",
};

export function ScoreTrend({ data }: { data: CohortStatsResult["score_trend"] }) {
  return (
    <ChartFrame
      title="Evolução do score médio de risco"
      subtitle="Probabilidade média de churn da base ao longo dos meses."
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d8dde3" vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={{ stroke: "#d8dde3" }} />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [pct(Number(v)), "Score médio"]} />
          <Line
            type="monotone"
            dataKey="avg_score"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#14b8a6" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function TierSplit({ data }: { data: CohortStatsResult["tier_split"] }) {
  const chartData = data.map((t) => ({ ...t, label: TIER_LABELS[t.tier] }));
  return (
    <ChartFrame
      title="Base por faixa de risco"
      subtitle="Distribuição dos membros entre os tiers de risco."
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d8dde3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d8dde3" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v), "Membros"]} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {chartData.map((t) => (
              <Cell key={t.tier} fill={TIER_FILL[t.tier]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
