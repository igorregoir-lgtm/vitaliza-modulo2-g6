import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AprenderCard } from "@/components/aprender-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThresholdExplorer } from "@/components/trilha/threshold-explorer";
import { CalibrationCurve } from "@/components/trilha/calibration-curve";
import { getScoredCustomers } from "@/lib/scoring";

export const metadata: Metadata = { title: "Avaliar o sistema" };

export default async function AvaliarPage() {
  const scored = await getScoredCustomers();
  const points = scored
    .filter((s) => s.customer.true_churn === 0 || s.customer.true_churn === 1)
    .map((s) => ({ p: Number(s.prediction.churn_probability), y: s.customer.true_churn as 0 | 1 }));
  const threshold = scored[0]?.prediction.threshold ?? 0.5;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Avaliar · visão de sistema"
        title="Avaliar o sistema"
        description="Onde colocar o corte de decisão e o quanto confiar no modelo — as escolhas que transformam um bom modelo em uma boa operação."
      />

      <AprenderCard
        screen="Avaliar o sistema"
        title="Do modelo à política de decisão"
        tease="Mexa no corte e veja recall, falsos positivos e ROI se moverem juntos."
      />

      <Card>
        <CardHeader>
          <CardTitle>Onde colocar o corte (threshold)</CardTitle>
          <CardDescription>
            O modelo dá uma probabilidade; a operação precisa de um corte para decidir quem contatar.
            Um corte baixo pega quase todos os churns (recall alto), mas gera muitos falsos positivos.
            O melhor corte é o que maximiza o ROI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThresholdExplorer points={points} defaultCutoff={threshold} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>O quanto confiar no modelo (calibração)</CardTitle>
          <CardDescription>
            Quando o modelo diz 70%, cerca de 70% de fato cancelam? A calibração mede a confiança das
            previsões — distinta da acurácia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CalibrationCurve points={points} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>A decisão que o modelo não toma sozinho</CardTitle>
          <CardDescription>Ética e não-intrusão fazem parte da avaliação do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-deep)]" />
            <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
              Nem todo membro em risco deve ser contatado. Os perfis &quot;cão que dorme&quot;
              (vínculo longo, uso quase zero) são <span className="font-medium text-[var(--ink)]">excluídos
              de campanhas proativas</span> por código: para eles, intervir tende a antecipar o
              cancelamento. Avaliar o sistema é também decidir quando <span className="font-medium text-[var(--ink)]">não
              agir</span> — e lembrar que o SHAP descreve o comportamento do modelo, não relações de
              causa e efeito do mundo real.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
