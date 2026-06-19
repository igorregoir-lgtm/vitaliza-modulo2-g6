"use client";

// ============================================================================
// Casos contrastantes (#3) — dois membros lado a lado, para enxergar POR QUE o
// modelo os separa. Reusa /api/explain/[id]. Default: o de maior risco × o de
// menor risco (a lista chega ordenada por risco desc).
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §6.
// ============================================================================

import * as React from "react";
import { ArrowDown, ArrowUp, GitCompareArrows } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge } from "@/components/tier-badge";
import { featureLabel, ARCHETYPE_LABELS } from "@/lib/labels";
import { pct } from "@/lib/utils";
import type { ExplainResponse } from "@/lib/types";

interface MemberOption {
  id: string;
  label: string;
}

export function ContrastingCases({ members }: { members: MemberOption[] }) {
  const [idA, setIdA] = React.useState(members[0]?.id ?? "");
  const [idB, setIdB] = React.useState(members[members.length - 1]?.id ?? "");

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[var(--accent-light)]/30 p-4">
          <div className="flex items-start gap-3">
            <GitCompareArrows className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-deep)]" />
            <div>
              <p className="font-semibold text-[var(--accent-deep)]">Casos contrastantes</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Compare dois membros lado a lado. Repare em quais variáveis o modelo usou para
                separá-los — a explicação descreve o comportamento do modelo, não causa e efeito.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CaseColumn members={members} value={idA} onChange={setIdA} />
          <CaseColumn members={members} value={idB} onChange={setIdB} />
        </div>
      </CardContent>
    </Card>
  );
}

function CaseColumn({
  members,
  value,
  onChange,
}: {
  members: MemberOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [data, setData] = React.useState<ExplainResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!value) return;
    let ignore = false;
    async function load(id: string) {
      if (ignore) return;
      setData(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/explain/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as ExplainResponse;
        if (!ignore) setData(json);
      } catch {
        if (!ignore) setData(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void Promise.resolve().then(() => load(value));
    return () => {
      ignore = true;
    };
  }, [value]);

  const top = data ? [...data.top_drivers].slice(0, 5) : [];
  const maxAbs = top.reduce((m, d) => Math.max(m, Math.abs(d.shap_value)), 0) || 1;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper)] p-4">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Selecionar membro para comparar">
          <SelectValue placeholder="Selecione um membro" />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      )}

      {!loading && data && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-sm font-semibold text-[var(--ink)]">
              {pct(data.churn_probability, 0)}
            </span>
            <TierBadge tier={data.risk_tier} />
            <Badge variant="outline">{ARCHETYPE_LABELS[data.archetype]}</Badge>
          </div>

          <div className="flex flex-col gap-2">
            <p className="eyebrow">Principais fatores (SHAP)</p>
            {top.map((d) => {
              const up = d.shap_value >= 0;
              const w = Math.round((Math.abs(d.shap_value) / maxAbs) * 100);
              return (
                <div key={d.feature} className="flex items-center gap-2">
                  <span className="flex w-1/2 min-w-0 items-center gap-1 text-xs text-[var(--ink-soft)]">
                    {up ? (
                      <ArrowUp className="h-3 w-3 shrink-0 text-[var(--tier-alto)]" />
                    ) : (
                      <ArrowDown className="h-3 w-3 shrink-0 text-[var(--accent-deep)]" />
                    )}
                    <span className="truncate">{featureLabel(d.feature)}</span>
                    {d.actionable && (
                      <span className="shrink-0 rounded-full bg-[var(--accent-light)] px-1.5 text-[9px] font-medium uppercase tracking-wide text-[var(--accent-deep)]">
                        ação
                      </span>
                    )}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--cloud)]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${w}%`,
                        backgroundColor: up ? "var(--tier-alto)" : "var(--accent)",
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && !data && (
        <p className="py-6 text-center text-xs text-[var(--steel)]">
          Não foi possível carregar este membro.
        </p>
      )}
    </div>
  );
}
