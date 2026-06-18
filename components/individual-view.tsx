"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Send,
  ShieldAlert,
  CircleCheck,
  Megaphone,
  Clock,
  MessageSquare,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskGauge } from "@/components/risk-gauge";
import { ShapWaterfall } from "@/components/shap-waterfall";
import { TierBadge } from "@/components/tier-badge";
import { LiveSimulator } from "@/components/simulator/live-simulator";
import { ARCHETYPE_DESC, ARCHETYPE_LABELS } from "@/lib/labels";
import type { AdvisorResult, CustomerFeatures, ExplainResponse, PredictResult } from "@/lib/types";

interface MemberOption {
  id: string;
  label: string;
}

export function IndividualView({ members }: { members: MemberOption[] }) {
  const [selected, setSelected] = React.useState<string>(members[0]?.id ?? "");
  const [pred, setPred] = React.useState<PredictResult | null>(null);
  const [features, setFeatures] = React.useState<CustomerFeatures | null>(null);
  const [advisor, setAdvisor] = React.useState<AdvisorResult | null>(null);
  const [loadingPred, setLoadingPred] = React.useState(false);
  const [loadingAdvisor, setLoadingAdvisor] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    let ignore = false;

    async function load(id: string) {
      // Reset + loading happen inside the async continuation (not synchronously
      // in the effect body) to avoid cascading renders.
      if (ignore) return;
      setPred(null);
      setFeatures(null);
      setAdvisor(null);
      setApplied(false);
      setLoadingPred(true);
      try {
        const res = await fetch(`/api/explain/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as ExplainResponse;
        if (!ignore) {
          setPred(data);
          setFeatures(data.features);
        }
      } catch {
        if (!ignore) toast.error("Não foi possível carregar a previsão do membro.");
      } finally {
        if (!ignore) setLoadingPred(false);
      }
    }

    void Promise.resolve().then(() => load(selected));
    return () => {
      ignore = true;
    };
  }, [selected]);

  async function runAdvisor() {
    if (!selected) return;
    setLoadingAdvisor(true);
    setAdvisor(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected }),
      });
      const data = (await res.json()) as AdvisorResult & { degraded?: boolean };
      setAdvisor(data);
      if (data.degraded) toast.warning("Agente em modo de contingência (sem LLM). Recomendação gerada por regras.");
    } catch {
      toast.error("Falha ao gerar a recomendação.");
    } finally {
      setLoadingAdvisor(false);
    }
  }

  async function applyIntervention() {
    if (!selected || !advisor?.recommendation) return;
    setApplying(true);
    try {
      const res = await fetch("/api/apply-intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected,
          archetype: pred?.archetype,
          offer: advisor.recommendation.offer,
          channel: advisor.recommendation.channel,
          copy: advisor.recommendation.copy,
          timing: advisor.recommendation.timing,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setApplied(true);
        toast.success(
          data.persisted
            ? "Intervenção registrada no banco e auditada."
            : "Intervenção registrada (auditada). Persistência no banco aguarda seed da base.",
        );
      } else {
        toast.error("Não foi possível registrar a intervenção.");
      }
    } catch {
      toast.error("Falha ao aplicar a intervenção.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Member selector */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="member">Membro</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="member" className="w-64">
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
          </div>
          <p className="max-w-md text-xs text-[var(--steel)]">
            Escolha um membro para ver o score, a explicação local (SHAP) e a recomendação
            prescritiva de retenção.
          </p>
        </CardContent>
      </Card>

      {loadingPred && <LoadingState />}

      {!loadingPred && pred && (
        <>
          {/* Score + archetype + waterfall */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Score de risco</CardTitle>
                <CardDescription>Probabilidade estimada de cancelamento.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <RiskGauge
                  probability={pred.churn_probability}
                  tier={pred.risk_tier}
                  threshold={pred.threshold}
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <TierBadge tier={pred.risk_tier} />
                  <Badge variant="outline">{ARCHETYPE_LABELS[pred.archetype]}</Badge>
                </div>
                <p className="text-center text-xs text-[var(--steel)]">
                  {ARCHETYPE_DESC[pred.archetype]}
                </p>
                <p className="mono text-[10px] text-[var(--steel-soft)]">
                  modelo {pred.model_version}
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Explicação local (SHAP)</CardTitle>
                <CardDescription>
                  Quais variáveis pesaram neste caso e quais a operação consegue mudar. A leitura
                  descreve o comportamento do modelo — não relações de causa e efeito.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShapWaterfall shap={pred.shap_local} />
              </CardContent>
            </Card>
          </div>

          {/* Live what-if simulator — arraste alavancas e veja o modelo recalcular */}
          {features && (
            <LiveSimulator
              key={selected}
              externalRef={selected}
              features={features}
              realProb={pred.churn_probability}
            />
          )}

          {/* Advisor */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Explicação narrativa e recomendação</CardTitle>
                <CardDescription>
                  Função A (narrativa, ≤150 palavras) + Função B (oferta prescritiva), com
                  guardrails de não-intrusão.
                </CardDescription>
              </div>
              {!advisor && (
                <Button variant="accent" onClick={runAdvisor} disabled={loadingAdvisor}>
                  {loadingAdvisor ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Gerar recomendação
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingAdvisor && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-9/12" />
                </div>
              )}

              {!loadingAdvisor && !advisor && (
                <p className="text-sm text-[var(--steel)]">
                  Clique em &quot;Gerar recomendação&quot; para o agente consultor explicar o caso e
                  propor uma ação.
                </p>
              )}

              {advisor && (
                <div className="flex flex-col gap-4">
                  {/* Narrative */}
                  <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
                    <p className="eyebrow mb-1.5">Explicação (Função A)</p>
                    <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
                      {advisor.narrative}
                    </p>
                  </div>

                  {advisor.blocked ? (
                    <SleepingDogBanner reason={advisor.blocked_reason} />
                  ) : advisor.recommendation ? (
                    <RecommendationCard
                      rec={advisor.recommendation}
                      onApply={applyIntervention}
                      applying={applying}
                      applied={applied}
                    />
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SleepingDogBanner({ reason }: { reason?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--tier-medio)] bg-[#fbf3df] p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6d1f]" />
        <div>
          <p className="text-sm font-semibold text-[#8a6d1f]">
            Não acorde o cão que dorme — sem ação proativa
          </p>
          <p className="mt-1 text-sm text-[#7a611c]">{reason}</p>
          <Link
            href="/principios-de-personalizacao"
            className="mt-2 inline-block text-xs font-medium text-[var(--accent-deep)] underline-offset-2 hover:underline"
          >
            Ver política de não-intrusão
          </Link>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  onApply,
  applying,
  applied,
}: {
  rec: NonNullable<AdvisorResult["recommendation"]>;
  onApply: () => void;
  applying: boolean;
  applied: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[var(--accent-light)]/30 p-4">
      <p className="eyebrow mb-3 text-[var(--accent-deep)]">Recomendação prescritiva (Função B)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field icon={Megaphone} label="Oferta" value={rec.offer} />
        <Field icon={MessageSquare} label="Canal" value={rec.channel.join(", ")} />
        <Field icon={Clock} label="Timing" value={rec.timing} />
        <Field icon={Send} label="Copy sugerida" value={rec.copy} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="accent" onClick={onApply} disabled={applying || applied}>
          {applying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : applied ? (
            <CircleCheck className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {applied ? "Intervenção registrada" : "Aplicar intervenção"}
        </Button>
        <span className="text-xs text-[var(--steel)]">
          Registra em <span className="mono">intervention</span> + <span className="mono">audit_log</span>.
        </span>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-[var(--paper)] p-3">
      <p className="eyebrow mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-sm text-[var(--ink-soft)]">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-72 lg:col-span-1" />
      <Skeleton className="h-72 lg:col-span-2" />
    </div>
  );
}
