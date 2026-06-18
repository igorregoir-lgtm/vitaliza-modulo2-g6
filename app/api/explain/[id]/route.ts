import { NextResponse } from "next/server";
import { getScoredCustomer } from "@/lib/scoring";
import { writeAudit } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";

// TODO: wire to /api/py inference for live SHAP local values.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const scored = await getScoredCustomer(id);
    if (!scored) {
      return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
    }

    const user = await getSessionUser();
    await writeAudit({
      actor: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: "explain",
      entity: "customer",
      entity_id: String(id),
      payload: {
        source: scored.source,
        churn_probability: scored.prediction.churn_probability,
        risk_tier: scored.prediction.risk_tier,
        archetype: scored.prediction.archetype,
        model_version: scored.prediction.model_version,
        ts: new Date().toISOString(),
      },
    });

    // Devolve a previsão + o snapshot de features (para o simulador what-if
    // client-side ancorar o delta no score real). Ver ADR-0014.
    return NextResponse.json({ ...scored.prediction, features: scored.customer.features });
  } catch (err) {
    console.error("[explain]", err);
    return NextResponse.json({ error: "falha na explicação" }, { status: 500 });
  }
}
