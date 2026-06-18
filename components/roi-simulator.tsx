"use client";

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { brl, pct } from "@/lib/utils";

interface RoiSimulatorProps {
  /** Number of at-risk members eligible for intervention. */
  atRiskCount: number;
  /** Average monthly revenue per member (LTV proxy input). */
  avgMonthlyRevenue?: number;
  /** Months of LTV preserved when a churn is avoided. */
  ltvMonths?: number;
}

export function RoiSimulator({
  atRiskCount,
  avgMonthlyRevenue = 89,
  ltvMonths = 8,
}: RoiSimulatorProps) {
  const [acceptRate, setAcceptRate] = React.useState(35); // %
  const [costPer, setCostPer] = React.useState(40); // R$
  const [reach, setReach] = React.useState(70); // % of at-risk actually contacted

  const contacted = Math.round((atRiskCount * reach) / 100);
  const recovered = Math.round((contacted * acceptRate) / 100);
  const ltvPerMember = avgMonthlyRevenue * ltvMonths;
  const preservedRevenue = recovered * ltvPerMember;
  const totalCost = contacted * costPer;
  const net = preservedRevenue - totalCost;
  const roi = totalCost > 0 ? net / totalCost : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulador de ROI da retenção</CardTitle>
        <CardDescription>
          Ajuste os parâmetros da campanha e veja a receita preservada recalculada ao vivo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Controls */}
          <div className="flex flex-col gap-5">
            <SliderRow
              label="Cobertura da campanha"
              value={reach}
              suffix="%"
              min={0}
              max={100}
              step={5}
              onChange={setReach}
              hint={`${contacted} de ${atRiskCount} em risco contatados`}
            />
            <SliderRow
              label="Taxa de aceite"
              value={acceptRate}
              suffix="%"
              min={0}
              max={100}
              step={1}
              onChange={setAcceptRate}
              hint={`${recovered} membros recuperados`}
            />
            <SliderRow
              label="Custo médio por intervenção"
              value={costPer}
              prefix="R$ "
              min={0}
              max={200}
              step={5}
              onChange={setCostPer}
              hint={`Custo total: ${brl(totalCost)}`}
            />
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Receita preservada" value={brl(preservedRevenue)} accent />
            <Metric label="Custo da campanha" value={brl(totalCost)} />
            <Metric label="Resultado líquido" value={brl(net)} accent={net >= 0} negative={net < 0} />
            <Metric label="ROI" value={`${roi >= 0 ? "+" : ""}${pct(roi, 0)}`} accent={roi >= 0} negative={roi < 0} />
            <div className="col-span-2 rounded-[var(--radius-md)] border border-[var(--rule-soft)] bg-[var(--cloud)] p-3 text-[11px] leading-relaxed text-[var(--steel)]">
              Premissas: LTV preservado de {ltvMonths} meses × {brl(avgMonthlyRevenue)}/mês ={" "}
              {brl(ltvPerMember)} por membro recuperado. &quot;Cães que dormem&quot; ficam fora da
              base elegível (não-intrusão).
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix = "",
  suffix = "",
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-[var(--ink-soft)]">{label}</span>
        <span className="mono text-sm font-semibold text-[var(--ink)]">
          {prefix}
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      />
      {hint && <p className="mt-1.5 text-xs text-[var(--steel)]">{hint}</p>}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  negative,
}: {
  label: string;
  value: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper)] p-3">
      <p className="eyebrow mb-1">{label}</p>
      <p
        className="mono text-lg font-semibold"
        style={{
          color: negative ? "var(--tier-critico)" : accent ? "var(--accent-deep)" : "var(--ink)",
        }}
      >
        {value}
      </p>
    </div>
  );
}
