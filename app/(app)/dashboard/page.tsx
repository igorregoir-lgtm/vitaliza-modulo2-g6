import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { AprenderCard } from "@/components/aprender-card";
import { RoiSimulator } from "@/components/roi-simulator";
import { ScoreTrend, TierSplit } from "@/components/charts/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { computeCohortStats } from "@/lib/analytics";
import { pct } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard Executivo" };

export default async function DashboardPage() {
  const stats = await computeCohortStats();

  const atRisk = stats.tier_split
    .filter((t) => t.tier === "alto" || t.tier === "critico")
    .reduce((s, t) => s + t.count, 0);

  // Scale at-risk to a realistic base size for the simulator (sample base is small).
  const scaledAtRisk = Math.max(atRisk, Math.round((stats.n || 8) * 5.5));

  const isEmpty = stats.n === 0 || stats.tier_split.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Conselho / CFO"
        title="Dashboard Executivo"
        description="Visão agregada de retenção: indicadores de negócio, evolução do risco e o impacto financeiro das intervenções."
      >
        <Badge variant="muted">Base analisada: {stats.n} membros</Badge>
      </PageHeader>

      <AprenderCard
        screen="Dashboard Executivo"
        title="Por que este painel existe"
        what="Reúne os indicadores de negócio (churn, LTV, LTV/CAC, retenção) e traduz o risco do modelo em impacto financeiro com um simulador de ROI."
        why="A liderança decide com base em números de negócio, não em métricas de modelo. Conectar score → receita preservada mostra, em reais, o valor da retenção orientada por dados."
        bullets={[
          "Churn mensal e meta vêm do case Vitaliza (10,2% atual vs. 6,0% de meta).",
          "O simulador usa premissas explícitas — nada é caixa-preta.",
        ]}
      />

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--rule)] bg-[var(--paper-soft)] px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cloud)] text-[var(--steel)]">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div className="max-w-sm">
            <p className="text-sm font-medium text-[var(--ink-soft)]">
              Sem dados para exibir
            </p>
            <p className="mt-1 text-xs text-[var(--steel)]">
              Ainda não há membros analisados. Popule a tabela{" "}
              <span className="mono">customer</span> no Supabase para ver os
              indicadores, a evolução do risco e o simulador de ROI.
            </p>
          </div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard label="Churn mensal" value={pct(stats.churn_rate)} trend="up" upIsGood={false} target="6,0%" hint="atual" />
            <KpiCard label="LTV médio" value="R$ 712" trend="flat" hint="por membro" />
            <KpiCard label="LTV / CAC" value="2,02" trend="up" upIsGood target="≥ 3,0" hint="piso Série B" />
            <KpiCard label="Retenção mês 6" value="48%" trend="down" upIsGood hint="cohort 6m" />
            <KpiCard label="Score médio de risco" value={pct(stats.avg_score)} trend="down" upIsGood hint="da base" />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ScoreTrend data={stats.score_trend} />
            <TierSplit data={stats.tier_split} />
          </section>

          <RoiSimulator atRiskCount={scaledAtRisk} />
        </>
      )}
    </div>
  );
}
