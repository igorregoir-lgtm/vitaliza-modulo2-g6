import { NextResponse } from "next/server";
import { getScoredCustomers } from "@/lib/scoring";
import { runCapstoneSummary, fallbackCapstoneSummary, type CapstoneInput } from "@/lib/agent";

// ============================================================================
// Capstone (#6) — resumo executivo da Trilha. Calcula base/taxa-base no servidor
// (escores reais) e recebe os destaques (missões concluídas) do cliente. Nunca
// retorna 500 por falta de chave: degrada para o resumo determinístico.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §5, §10.
// ============================================================================

export async function POST(req: Request) {
  let highlights: string[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.highlights)) {
      highlights = body.highlights.filter((x: unknown) => typeof x === "string").slice(0, 8);
    }
  } catch {
    // body opcional
  }

  const scored = await getScoredCustomers();
  const labeled = scored.filter((s) => s.customer.true_churn === 0 || s.customer.true_churn === 1);
  const n = scored.length;
  const baseRate = labeled.length
    ? labeled.reduce((acc, s) => acc + (s.customer.true_churn as number), 0) / labeled.length
    : 0;

  const input: CapstoneInput = { baseRate, n, highlights };

  try {
    const summary = await runCapstoneSummary(input);
    if (summary && summary.trim().length > 0) {
      return NextResponse.json({ summary, source: "llm" });
    }
  } catch (err) {
    console.error("[trilha-summary]", err);
  }
  return NextResponse.json({ summary: fallbackCapstoneSummary(input), source: "fallback" });
}
