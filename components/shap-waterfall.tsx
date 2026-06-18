"use client";

import { featureLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ShapDriver, ShapLocal } from "@/lib/types";

/**
 * Local SHAP waterfall. Each bar is one driver's contribution to the logit;
 * positive (teal-red) pushes toward churn, negative pulls away. Actionable
 * drivers are marked so the operation knows what it can change.
 */
export function ShapWaterfall({ shap }: { shap: ShapLocal }) {
  const drivers = [...shap.contributions].sort(
    (a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value),
  );
  const maxAbs = Math.max(...drivers.map((d) => Math.abs(d.shap_value)), 0.001);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--steel)]">
          <span>← reduz o risco</span>
          <span className="mono">base: {(shap.base_value * 100).toFixed(0)}%</span>
          <span>aumenta o risco →</span>
        </div>
        {drivers.map((d) => (
          <WaterfallRow key={d.feature} driver={d} maxAbs={maxAbs} />
        ))}
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--steel)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--tier-critico)" }} />
            aumenta churn
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--accent)" }} />
            reduz churn
          </span>
          <span className="flex items-center gap-1.5">
            <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
              acionável
            </Badge>
            a operação pode mudar
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

function WaterfallRow({ driver, maxAbs }: { driver: ShapDriver; maxAbs: number }) {
  const positive = driver.shap_value >= 0;
  const widthPct = (Math.abs(driver.shap_value) / maxAbs) * 50; // half-width each side
  const color = positive ? "var(--tier-critico)" : "var(--accent)";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs text-[var(--ink-soft)] sm:w-44" title={featureLabel(driver.feature)}>
              {featureLabel(driver.feature)}
            </span>
            {driver.actionable && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                aria-label="acionável"
              />
            )}
            {/* center-anchored bar */}
            <div className="relative h-4 flex-1">
              <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--rule)]" />
              <div
                className="absolute top-0 h-full rounded-sm"
                style={{
                  width: `${widthPct}%`,
                  background: color,
                  left: positive ? "50%" : `${50 - widthPct}%`,
                }}
              />
            </div>
          </div>
          <span className="mono w-14 text-right text-xs" style={{ color }}>
            {positive ? "+" : ""}
            {driver.shap_value.toFixed(3)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold">{featureLabel(driver.feature)}</p>
        <p>Valor: {String(driver.value)}</p>
        <p>Contribuição SHAP: {driver.shap_value.toFixed(4)}</p>
        <p>{driver.actionable ? "Acionável pela operação" : "Não-acionável"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
