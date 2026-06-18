"use client";

// ============================================================================
// Lever controls — sliders / toggle / select for the actionable what-if knobs.
// See docs/superpowers/specs/2026-06-17-simulador-vivo-design.md §6 e §9.
// Reusa apenas tokens de app/globals.css e componentes ui/*. Sentence case.
// Acessibilidade: <Label> nos sliders, aria-pressed no toggle, foco visível.
// ============================================================================

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LEVERS, type LeverDef } from "@/lib/simulator/levers";
import type { CustomerFeatures } from "@/lib/types";

/** Friendly display of a lever value (1 decimal for fractional, integer otherwise). */
function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

export interface LeverControlsProps {
  /** Current override values per lever feature. */
  values: Record<string, number>;
  /** Called with (feature, value) on every change. */
  onChange: (feature: keyof CustomerFeatures, value: number) => void;
}

export function LeverControls({ values, onChange }: LeverControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      {LEVERS.map((lever) => (
        <LeverRow
          key={lever.feature}
          lever={lever}
          value={Number(values[lever.feature] ?? 0)}
          onChange={(v) => onChange(lever.feature, v)}
        />
      ))}
    </div>
  );
}

function LeverRow({
  lever,
  value,
  onChange,
}: {
  lever: LeverDef;
  value: number;
  onChange: (value: number) => void;
}) {
  const controlId = `lever-${lever.feature}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={controlId}>{lever.label}</Label>
        {lever.control !== "toggle" && (
          <span className="mono text-xs text-[var(--ink-soft)]">
            {formatValue(value)}
            {lever.unit ? ` ${lever.unit}` : ""}
          </span>
        )}
      </div>

      {lever.control === "slider" && (
        <SliderControl id={controlId} lever={lever} value={value} onChange={onChange} />
      )}
      {lever.control === "toggle" && (
        <ToggleControl id={controlId} lever={lever} value={value} onChange={onChange} />
      )}
      {lever.control === "select" && (
        <SelectControl id={controlId} lever={lever} value={value} onChange={onChange} />
      )}

      <p className="text-xs leading-relaxed text-[var(--steel)]">{lever.microcopy}</p>
    </div>
  );
}

function SliderControl({
  id,
  lever,
  value,
  onChange,
}: {
  id: string;
  lever: LeverDef;
  value: number;
  onChange: (value: number) => void;
}) {
  const min = lever.min ?? 0;
  const max = lever.max ?? 0;
  const step = lever.step ?? 1;
  return (
    <Slider
      id={id}
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={(v) => onChange(v[0] ?? min)}
      aria-label={lever.label}
      aria-valuetext={`${formatValue(value)}${lever.unit ? ` ${lever.unit}` : ""}`}
    />
  );
}

function ToggleControl({
  id,
  lever,
  value,
  onChange,
}: {
  id: string;
  lever: LeverDef;
  value: number;
  onChange: (value: number) => void;
}) {
  const on = value >= 0.5;
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={lever.label}
      onClick={() => onChange(on ? 0 : 1)}
      className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper)] px-1 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      <span
        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
          on ? "bg-[var(--accent)]" : "bg-[var(--cloud)]"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-[var(--paper)] shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span className="pr-2 text-xs font-medium text-[var(--ink-soft)]">
        {on ? "Incluído" : "Fora"}
      </span>
    </button>
  );
}

function SelectControl({
  id,
  lever,
  value,
  onChange,
}: {
  id: string;
  lever: LeverDef;
  value: number;
  onChange: (value: number) => void;
}) {
  const options = lever.options ?? [];
  return (
    <Select
      value={String(Math.round(value))}
      onValueChange={(v) => onChange(Number(v))}
    >
      <SelectTrigger id={id} className="w-40" aria-label={lever.label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={String(opt)}>
            {opt}
            {lever.unit ? ` ${lever.unit}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
