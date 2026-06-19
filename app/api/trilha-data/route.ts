import { NextResponse } from "next/server";
import { getScoredCustomers } from "@/lib/scoring";

// ============================================================================
// Dados da estação "Avaliar" da Trilha: pares (p, y) REAIS — probabilidade do
// modelo × churn observado — para o explorador de threshold (#2) e a curva de
// calibração (#4). Server-only (usa o admin client via getScoredCustomers).
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §5, §10.
// ============================================================================

export async function GET() {
  try {
    const scored = await getScoredCustomers();
    const points = scored
      .filter((s) => s.customer.true_churn === 0 || s.customer.true_churn === 1)
      .map((s) => ({
        p: Number(s.prediction.churn_probability),
        y: s.customer.true_churn as 0 | 1,
      }));
    const n = points.length;
    const baseRate = n ? points.reduce((acc, pt) => acc + pt.y, 0) / n : 0;
    const threshold = scored[0]?.prediction.threshold ?? 0.5;
    return NextResponse.json({ points, baseRate, n, threshold });
  } catch (err) {
    console.error("[trilha-data]", err);
    return NextResponse.json({ points: [], baseRate: 0, n: 0, threshold: 0.5 }, { status: 200 });
  }
}
