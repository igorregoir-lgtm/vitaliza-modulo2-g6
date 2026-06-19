"use client";

// ============================================================================
// Progresso da Trilha em sessionStorage (sem login, sem servidor — ADR-0015).
// sessionStorage (não localStorage) p/ que cada VISITA comece limpa: zera ao
// fechar a aba/janela, mas sobrevive a um reload acidental no meio do tour.
// Botão "Reiniciar trilha" na capa permite zerar manualmente a qualquer momento.
// Usa useSyncExternalStore (idiomático p/ store externo + SSR-safe; sem
// setState-em-efeito); same-tab via evento custom disparado nas escritas.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §5, §10.
// ============================================================================

import * as React from "react";
import { TRILHA_TOTAL, type MissionId } from "@/lib/trilha/missions";

const STORAGE_KEY = "vitaliza:trilha:v1";
const CHANGE_EVENT = "vitaliza:trilha:change";
const EMPTY: MissionId[] = [];

// Cache para manter referência estável entre snapshots (exigência do
// useSyncExternalStore: só muda a referência quando o valor de fato muda).
let cachedRaw: string | null = null;
let cachedValue: MissionId[] = EMPTY;

function parse(raw: string | null): MissionId[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((x): x is MissionId => typeof x === "string");
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): MissionId[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function getServerSnapshot(): MissionId[] {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
}

function write(ids: MissionId[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // modo privado / quota — falha silenciosa.
  }
  cachedRaw = null; // invalida o cache; o próximo getSnapshot relê.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface TrilhaProgress {
  completed: MissionId[];
  isComplete: (id: MissionId) => boolean;
  markComplete: (id: MissionId) => void;
  reset: () => void;
  /** 0..100 (inteiro). */
  pct: number;
  /** false no servidor / antes da hidratação. */
  hydrated: boolean;
}

// hydrated sem setState-em-efeito: snapshot do cliente = true, do servidor = false.
const noopSubscribe = () => () => {};
const trueSnapshot = () => true;
const falseSnapshot = () => false;

export function useTrilhaProgress(): TrilhaProgress {
  const completed = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = React.useSyncExternalStore(noopSubscribe, trueSnapshot, falseSnapshot);

  const markComplete = React.useCallback((id: MissionId) => {
    const current = getSnapshot();
    if (current.includes(id)) return;
    write([...current, id]);
  }, []);

  const reset = React.useCallback(() => {
    write([]);
  }, []);

  const isComplete = React.useCallback((id: MissionId) => completed.includes(id), [completed]);

  const pct = Math.round((completed.length / TRILHA_TOTAL) * 100);

  return { completed, isComplete, markComplete, reset, pct, hydrated };
}
