"use client";

// ============================================================================
// Live simulator — orquestrador do laboratório what-if na Consulta Individual.
// See docs/superpowers/specs/2026-06-17-simulador-vivo-design.md §3, §5, §9, §10.
//
// Layout: cabeçalho (estilo banner) -> otimizador (topo) -> linha "Ver a IA
// mudar de ideia" (auto-demo) + "Tutor Explica" -> painel de TEXTO do tutor
// (áudio opcional dentro) -> antes→depois -> alavancas | versão simulada
// (score / arquétipo / waterfall rotulados) -> "Aplicar Intervenção" + "Resetar".
// Toda explicação é TEXTO; o áudio é opcional dentro do "Tutor Explica".
// ============================================================================

import * as React from "react";
import { toast } from "sonner";
import {
  Volume2,
  Square,
  Loader2,
  Send,
  RotateCcw,
  CircleCheck,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "@/components/risk-gauge";
import { ShapWaterfall } from "@/components/shap-waterfall";
import { TierBadge } from "@/components/tier-badge";
import { TutorIcon } from "@/components/icons/tutor-icon";
import { useSpeak } from "@/components/tutor/use-speak";
import { LEVERS } from "@/lib/simulator/levers";
import { projectAnchored, findCheapestLever, type Projection } from "@/lib/simulator/engine";
import { tierFromProb } from "@/lib/heuristic";
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
  const [demoPlaying, setDemoPlaying] = React.useState(false);
  const [tutorOpen, setTutorOpen] = React.useState(false);
  const demoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Limpa o timer do auto-demo ao desmontar (inclui o remount ao trocar de
  // membro — o pai passa key={member}, então a instância é recriada limpa).
  React.useEffect(() => {
    return () => {
      if (demoTimer.current) clearTimeout(demoTimer.current);
    };
  }, []);

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
  // O tier da "versão simulada" segue a PROJEÇÃO ancorada (não a prob. crua da
  // heurística), para não contradizer o readout e o otimizador.
  const projectedTier = tierFromProb(projected);

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

  // Explicação do tutor em TEXTO (mesma redação que o áudio leria). O áudio é
  // opcional, disparado pelo botão "Ouvir" dentro do painel "Tutor Explica".
  const narration = React.useMemo(() => {
    const top = predNew.top_drivers[0];
    return buildNarration({
      realProb,
      projected,
      deltaPP,
      changedLevers,
      topDriverLabel: top ? featureLabel(top.feature) : "frequência de aulas",
      topDriverDir: top ? (top.shap_value >= 0 ? "up" : "down") : "up",
    });
  }, [realProb, projected, deltaPP, changedLevers, predNew]);

  // Sugestão do otimizador (parte do membro real) — também alimenta o auto-demo.
  const suggestion = React.useMemo(
    () => findCheapestLever(features, realProb),
    [features, realProb],
  );

  const stopDemo = React.useCallback(() => {
    if (demoTimer.current) {
      clearTimeout(demoTimer.current);
      demoTimer.current = null;
    }
    setDemoPlaying(false);
  }, []);

  // Auto-demo: anima a alavanca sugerida do valor atual até o alvo, recalculando
  // ao vivo (pula o debounce p/ fluidez) e ABRINDO o "Tutor Explica" em texto
  // (sem áudio automático). Respeita prefers-reduced-motion (salta) e
  // não-intrusão (botão some sem sugestão).
  function runAutoDemo() {
    if (demoPlaying) {
      stopDemo();
      return;
    }
    if (!suggestion) return;
    const lever = LEVERS.find((l) => l.feature === suggestion.feature);
    const from = Number(features[suggestion.feature] ?? 0);
    const to = suggestion.toValue;

    setOverrides(initial);
    setDebounced(initial);
    setTutorOpen(true); // explicação em TEXTO

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || lever?.control !== "slider") {
      setOverrides((prev) => ({ ...prev, [suggestion.feature]: to }));
      setDebounced((prev) => ({ ...prev, [suggestion.feature]: to }));
      return;
    }

    setDemoPlaying(true);
    const step = lever.step ?? 0.1;
    const decimals = (String(step).split(".")[1] ?? "").length;
    const STEPS = 30;
    let i = 0;
    const tick = () => {
      i += 1;
      const v = Number((from + ((to - from) * i) / STEPS).toFixed(decimals));
      const next = i >= STEPS ? to : v;
      setOverrides((prev) => ({ ...prev, [suggestion.feature]: next }));
      setDebounced((prev) => ({ ...prev, [suggestion.feature]: next }));
      if (i >= STEPS) {
        stopDemo();
        return;
      }
      demoTimer.current = setTimeout(tick, 110);
    };
    demoTimer.current = setTimeout(tick, 110);
  }

  function handleLeverChange(feature: keyof CustomerFeatures, value: number) {
    stopDemo();
    setOverrides((prev) => ({ ...prev, [feature]: value }));
  }

  function handleReset() {
    stopDemo();
    stopSpeaking();
    setOverrides(initial);
    setDebounced(initial);
  }

  // Áudio opcional do "Tutor Explica" — lê a mesma narração que está em texto.
  function handleSpeak() {
    if (playing) {
      stopSpeaking();
      return;
    }
    speak(narration);
  }

  async function handleApply() {
    setApplying(true);
    try {
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
      <CardContent className="flex flex-col gap-6 pt-6">
        {/* Cabeçalho — mesmo design do banner do otimizador (caixa accent) */}
        <div className="rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[var(--accent-light)]/30 p-4">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-deep)]" />
            <div>
              <p className="font-semibold text-[var(--accent-deep)]">Simule uma Intervenção</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Arraste uma alavanca e veja o modelo simular uma intervenção — o{" "}
                <span className="font-medium text-[var(--ink)]">score</span>, o{" "}
                <span className="font-medium text-[var(--ink)]">waterfall</span> e o{" "}
                <span className="font-medium text-[var(--ink)]">arquétipo</span> se ajustam à
                versão simulada. O efeito vem do modelo transparente, ancorado no score real.
              </p>
            </div>
          </div>
        </div>

        {/* Otimizador — subiu para o topo, logo após o cabeçalho. Só o texto da
            sugestão; a ação ("Simular esta alavanca") vive na linha abaixo. */}
        <OptimizerHint features={features} realProb={realProb} />

        {/* Descoberta: auto-demo + Tutor Explica (logo abaixo de "Simular esta alavanca") */}
        <div className="flex flex-wrap items-center gap-3">
          {suggestion && (
            <Button
              variant="accent"
              onClick={runAutoDemo}
              aria-label="Simular a alavanca sugerida ao vivo"
            >
              {demoPlaying ? (
                <Square className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {demoPlaying ? "Parar simulação" : "Simular esta alavanca"}
            </Button>
          )}
          <Button
            variant="accent"
            onClick={() => setTutorOpen((o) => !o)}
            aria-expanded={tutorOpen}
          >
            <TutorIcon className="h-4 w-4" />
            Tutor Explica
          </Button>
        </div>

        {/* Painel do Tutor Explica — explicação em TEXTO; áudio opcional dentro */}
        {tutorOpen && (
          <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="eyebrow text-[var(--accent-deep)]">Tutor explica</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSpeak}
                disabled={ttsLoading}
                aria-label={playing ? "Parar áudio" : "Ouvir em áudio"}
              >
                {ttsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : playing ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                {playing ? "Parar" : "Ouvir"}
              </Button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{narration}</p>
          </div>
        )}

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

          {/* Versão simulada: score + arquétipo + waterfall (rotulados) */}
          <div className="flex flex-col gap-4">
            <p className="eyebrow">Versão simulada</p>
            <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
              <p className="eyebrow">Score (risco de churn)</p>
              <div className="flex flex-col items-center gap-3">
                <RiskGauge
                  probability={projected}
                  tier={projectedTier}
                  threshold={predNew.threshold}
                />
                <div className="flex w-full flex-col items-center gap-1 border-t border-[var(--rule)] pt-3">
                  <p className="eyebrow">Arquétipo</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <TierBadge tier={projectedTier} />
                    <Badge variant="outline">{ARCHETYPE_LABELS[predNew.archetype]}</Badge>
                  </div>
                  <p className="text-center text-xs text-[var(--steel)]">
                    {ARCHETYPE_DESC[predNew.archetype]}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper)] p-4">
              <p className="eyebrow mb-2">Waterfall — explicação local (SHAP)</p>
              <ShapWaterfall shap={predNew.shap_local} />
            </div>
          </div>
        </div>

        {/* Ações finais: Aplicar Intervenção + Resetar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--rule)] pt-4">
          <Button
            variant="accent"
            onClick={handleApply}
            disabled={applying || applied || !isDirty}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : applied ? (
              <CircleCheck className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {applied ? "Intervenção registrada" : "Aplicar Intervenção"}
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
