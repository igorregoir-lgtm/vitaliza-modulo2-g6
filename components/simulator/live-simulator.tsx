"use client";

// ============================================================================
// Live simulator — orquestrador do laboratório what-if na Consulta Individual.
// See docs/superpowers/specs/2026-06-17-simulador-vivo-design.md §3, §5, §9, §10.
//
// Mantém o estado dos overrides das 4 alavancas, faz debounce ~120ms e roda
// projectAnchored() a cada mudança. Gauge + waterfall + badge de arquétipo
// refletem a versão SIMULADA (predNew). Botões: "Ouvir o que mudou" (voz on-
// demand via useSpeak + buildNarration), "Aplicar intervenção" (POST
// /api/apply-intervention) e "Resetar". Reusa apenas tokens/ui existentes.
// ============================================================================

import * as React from "react";
import { toast } from "sonner";
import { Volume2, Square, Loader2, Send, RotateCcw, CircleCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "@/components/risk-gauge";
import { ShapWaterfall } from "@/components/shap-waterfall";
import { TierBadge } from "@/components/tier-badge";
import { useSpeak } from "@/components/tutor/use-speak";
import { LEVERS } from "@/lib/simulator/levers";
import { projectAnchored, type Projection } from "@/lib/simulator/engine";
import { buildNarration } from "@/lib/simulator/narrate";
import { ARCHETYPE_DESC, ARCHETYPE_LABELS, featureLabel } from "@/lib/labels";
import type { CustomerFeatures } from "@/lib/types";
import { LeverControls } from "./lever-controls";
import { ProjectionReadout } from "./projection-readout";
import { OptimizerHint } from "./optimizer-hint";

const DEBOUNCE_MS = 120;

/** The lever features we override (subset of CustomerFeatures). */
const LEVER_FEATURES = LEVERS.map((l) => l.feature);

/** Seed the override map from the member's current feature values. */
function seedOverrides(features: CustomerFeatures): Record<string, number> {
  const out: Record<string, number> = {};
  for (const feat of LEVER_FEATURES) {
    out[feat] = Number(features[feat] ?? 0);
  }
  return out;
}

export function LiveSimulator({
  externalRef,
  features,
  realProb,
}: {
  externalRef: string;
  features: CustomerFeatures;
  realProb: number;
}): React.JSX.Element {
  const initial = React.useMemo(() => seedOverrides(features), [features]);

  // Live values (update on every drag); debounced values drive the projection.
  const [overrides, setOverrides] = React.useState<Record<string, number>>(initial);
  const [debounced, setDebounced] = React.useState<Record<string, number>>(initial);

  // Re-seed when the selected member changes — adjust state during render
  // instead of in an effect (avoids a cascading re-render). React docs pattern:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setOverrides(initial);
    setDebounced(initial);
  }

  // Debounce ~120ms before re-scoring (§10).
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(overrides), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [overrides]);

  const { speak, stopSpeaking, playing, ttsLoading } = useSpeak();
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  // Reset apply state if the simulation changes after applying — again adjusted
  // during render rather than in an effect to avoid the cascading render.
  const [prevDebounced, setPrevDebounced] = React.useState(debounced);
  if (prevDebounced !== debounced) {
    setPrevDebounced(debounced);
    setApplied(false);
  }

  // Build the override delta (only features that actually changed vs base).
  const overrideDelta = React.useMemo<Partial<CustomerFeatures>>(() => {
    const delta: Partial<CustomerFeatures> = {};
    for (const feat of LEVER_FEATURES) {
      const v = Number(debounced[feat] ?? 0);
      if (v !== Number(features[feat] ?? 0)) {
        (delta as Record<string, number>)[feat] = v;
      }
    }
    return delta;
  }, [debounced, features]);

  const projection: Projection = React.useMemo(
    () => projectAnchored(features, realProb, overrideDelta),
    [features, realProb, overrideDelta],
  );

  const { predNew, projected, deltaPP } = projection;

  const changedLevers = React.useMemo(
    () =>
      LEVERS.filter(
        (l) => Number(debounced[l.feature] ?? 0) !== Number(features[l.feature] ?? 0),
      ).map((l) => ({
        label: l.label,
        toValue: Number(debounced[l.feature] ?? 0),
        unit: l.unit,
      })),
    [debounced, features],
  );

  const isDirty = Object.keys(overrideDelta).length > 0;

  function handleLeverChange(feature: keyof CustomerFeatures, value: number) {
    setOverrides((prev) => ({ ...prev, [feature]: value }));
  }

  function handleReset() {
    stopSpeaking();
    setOverrides(initial);
    setDebounced(initial);
  }

  function handleSpeak() {
    if (playing) {
      stopSpeaking();
      return;
    }
    const top = predNew.top_drivers[0];
    const narration = buildNarration({
      realProb,
      projected,
      deltaPP,
      changedLevers,
      topDriverLabel: top ? featureLabel(top.feature) : "frequência de aulas",
      topDriverDir: top ? (top.shap_value >= 0 ? "up" : "down") : "up",
    });
    speak(narration);
  }

  async function handleApply() {
    setApplying(true);
    try {
      const top = predNew.top_drivers[0];
      const narration = buildNarration({
        realProb,
        projected,
        deltaPP,
        changedLevers,
        topDriverLabel: top ? featureLabel(top.feature) : "frequência de aulas",
        topDriverDir: top ? (top.shap_value >= 0 ? "up" : "down") : "up",
      });
      // Map the active levers/overrides to a human action string for the offer.
      const humanAction =
        changedLevers.length > 0
          ? LEVERS.filter(
              (l) =>
                Number(debounced[l.feature] ?? 0) !==
                Number(features[l.feature] ?? 0),
            )
              .map((l) => l.humanAction(Number(debounced[l.feature] ?? 0)))
              .join("; ")
          : "manter o plano de engajamento atual";

      const res = await fetch("/api/apply-intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: externalRef,
          archetype: predNew.archetype,
          offer: humanAction,
          channel: ["simulador"],
          copy: narration,
          timing: "imediato",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setApplied(true);
        if (data.blocked) {
          toast.warning(
            "Intervenção registrada como bloqueada (perfil de não-intrusão).",
          );
        } else {
          toast.success(
            data.persisted
              ? "Intervenção registrada no banco e auditada."
              : "Intervenção registrada (auditada). Persistência aguarda seed da base.",
          );
        }
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
    <Card>
      <CardHeader>
        <CardTitle>Simule uma intervenção</CardTitle>
        <CardDescription>
          Arraste uma alavanca e veja o modelo mudar de ideia ao vivo — score,
          waterfall e arquétipo se ajustam à versão simulada. O efeito vem do
          modelo transparente, ancorado no score real.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Antes → depois */}
        <ProjectionReadout realProb={realProb} projected={projected} deltaPP={deltaPP} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Alavancas */}
          <div className="flex flex-col gap-4">
            <p className="eyebrow">Alavancas acionáveis</p>
            <LeverControls values={overrides} onChange={handleLeverChange} />
            <p className="text-[10px] leading-relaxed text-[var(--steel-soft)]">
              Duração do plano e meses até o fim são editáveis de forma
              independente — uma simplificação aceitável do modelo transparente.
            </p>
          </div>

          {/* Versão simulada: gauge + arquétipo + waterfall */}
          <div className="flex flex-col gap-4">
            <p className="eyebrow">Versão simulada</p>
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
              <RiskGauge
                probability={projected}
                tier={predNew.risk_tier}
                threshold={predNew.threshold}
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <TierBadge tier={predNew.risk_tier} />
                <Badge variant="outline">{ARCHETYPE_LABELS[predNew.archetype]}</Badge>
              </div>
              <p className="text-center text-xs text-[var(--steel)]">
                {ARCHETYPE_DESC[predNew.archetype]}
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper)] p-4">
              <p className="eyebrow mb-2">Explicação local simulada (SHAP)</p>
              <ShapWaterfall shap={predNew.shap_local} />
            </div>
          </div>
        </div>

        {/* Otimizador */}
        <OptimizerHint
          features={features}
          realProb={realProb}
          onApply={handleLeverChange}
        />

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--rule)] pt-4">
          <Button variant="outline" onClick={handleSpeak} disabled={ttsLoading}>
            {ttsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : playing ? (
              <Square className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            {playing ? "Parar narração" : "Ouvir o que mudou"}
          </Button>

          <Button variant="accent" onClick={handleApply} disabled={applying || applied}>
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : applied ? (
              <CircleCheck className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {applied ? "Intervenção registrada" : "Aplicar intervenção"}
          </Button>

          <Button variant="ghost" onClick={handleReset} disabled={!isDirty}>
            <RotateCcw className="h-4 w-4" />
            Resetar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
