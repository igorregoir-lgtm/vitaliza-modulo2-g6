"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartFrame } from "./chart-frame";
import { pct } from "@/lib/utils";
import type { EdaSummary } from "@/lib/types";

const C = {
  primary: "#1e3a5f",
  accent: "#14b8a6",
  steel: "#5b7691",
  critico: "#c0463b",
  medio: "#d9a441",
  cloud: "#c7d2dd",
  rule: "#d8dde3",
};

const tooltipStyle = {
  background: "#fafafa",
  border: "1px solid #d8dde3",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "var(--font-jetbrains), monospace",
};

export function ChurnByContract({ data }: { data: EdaSummary["by_contract"] }) {
  return (
    <ChartFrame
      title="Churn por tipo de contrato"
      subtitle="Quanto mais curto o contrato, maior a taxa de cancelamento."
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: C.rule }} />
          <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [pct(Number(v)), "Taxa de churn"]}
          />
          <Bar dataKey="churn_rate" radius={[3, 3, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.contract} fill={d.churn_rate > 0.25 ? C.critico : C.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function SurvivalCurve({ data }: { data: EdaSummary["survival"] }) {
  return (
    <ChartFrame
      title="Retenção por tempo de assinatura"
      subtitle="Curva de sobrevivência aproximada: proporção retida ao longo dos meses."
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
          <XAxis dataKey="lifetime" tickLine={false} axisLine={{ stroke: C.rule }} unit="m" />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [pct(Number(v)), "Retenção"]} />
          <Line
            type="monotone"
            dataKey="retention"
            stroke={C.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function FreqByChurn({ data }: { data: EdaSummary["freq_dist"] }) {
  return (
    <ChartFrame
      title="Frequência no mês x churn"
      subtitle="Distribuição da frequência atual entre quem cancelou e quem permaneceu."
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={{ stroke: C.rule }} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar name="Cancelou" dataKey="churn" stackId="a" fill={C.critico} radius={[3, 3, 0, 0]} />
          <Bar name="Permaneceu" dataKey="retained" stackId="a" fill={C.accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function CorrelationHeatmap({ data }: { data: EdaSummary["correlation"] }) {
  const features = Array.from(new Set(data.map((c) => c.x)));
  const cell = (x: string, y: string) => data.find((c) => c.x === x && c.y === y)?.value ?? 0;
  const color = (v: number) => {
    // diverging accent (positive) / critico (negative)
    if (v >= 0) {
      const a = Math.min(1, v);
      return `rgba(20,184,166,${0.15 + a * 0.75})`;
    }
    const a = Math.min(1, -v);
    return `rgba(192,70,59,${0.15 + a * 0.75})`;
  };
  return (
    <ChartFrame
      title="Mapa de correlação"
      subtitle="Correlação entre variáveis-chave e o churn (teal = positiva, vermelho = negativa)."
    >
      <div className="overflow-x-auto">
        <table
          role="grid"
          aria-label="Mapa de correlação entre variáveis-chave e o churn"
          className="w-full border-separate border-spacing-0.5 text-center"
        >
          <thead>
            <tr>
              <th scope="col" className="p-1" />
              {features.map((f) => (
                <th
                  key={f}
                  scope="col"
                  className="mono p-1 text-[10px] text-[var(--steel)]"
                >
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((y) => (
              <tr key={y}>
                <th
                  scope="row"
                  className="mono p-1 text-right text-[10px] font-normal text-[var(--steel)]"
                >
                  {y}
                </th>
                {features.map((x) => {
                  const v = cell(x, y);
                  return (
                    <td
                      key={x}
                      className="mono p-1 text-[10px]"
                      style={{
                        background: color(v),
                        color: Math.abs(v) > 0.5 ? "#fff" : "var(--ink)",
                      }}
                      title={`${y} × ${x}: ${v.toFixed(2)}`}
                    >
                      {v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}

export function FreqScatter({ data }: { data: EdaSummary["scatter"] }) {
  const normal = data.filter((d) => !d.sleeping_dog);
  const dogs = data.filter((d) => d.sleeping_dog);
  return (
    <ChartFrame
      title="Frequência histórica × atual"
      subtitle="Cada ponto é um membro. Em destaque (âmbar), o perfil 'cão que dorme'."
    >
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.rule} />
          <XAxis
            type="number"
            dataKey="freq_total"
            name="Histórica"
            tickLine={false}
            axisLine={{ stroke: C.rule }}
            label={{ value: "freq. histórica", position: "insideBottom", offset: -2, fontSize: 10, fill: C.steel }}
          />
          <YAxis
            type="number"
            dataKey="freq_current"
            name="Atual"
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[35, 35]} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Scatter name="Membros" data={normal} fill={C.cloud} />
          <Scatter name="Cão que dorme" data={dogs} fill={C.medio} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ChurnByCohort({ data }: { data: EdaSummary["by_cohort"] }) {
  return (
    <ChartFrame
      title="Churn por cohort"
      subtitle="Taxa de cancelamento por faixa de tempo desde a entrada."
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
          <XAxis dataKey="cohort" tickLine={false} axisLine={{ stroke: C.rule }} />
          <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [pct(Number(v)), "Taxa de churn"]} />
          <Bar dataKey="churn_rate" radius={[3, 3, 0, 0]} fill={C.primary} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
