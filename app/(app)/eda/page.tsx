import type { Metadata } from "next";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AprenderCard } from "@/components/aprender-card";
import { EdaView } from "@/components/eda-view";
import { computeEdaSummary } from "@/lib/analytics";

export const metadata: Metadata = { title: "EDA Interativa" };

export default async function EdaPage() {
  const summary = await computeEdaSummary();
  const isEmpty = summary.by_contract.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Produto / Dados"
        title="EDA Interativa"
        description="Análise exploratória do comportamento da base: o que separa quem fica de quem cancela."
      />

      <AprenderCard
        screen="EDA Interativa"
        title="Por que explorar os dados antes de modelar"
        what="Mostra as seis visualizações-chave do case: churn por contrato e por cohort, retenção ao longo do tempo, distribuição de frequência, correlações e o scatter que isola os 'cães que dormem'."
        why="A EDA revela padrões e riscos (como vazamento de dados e segmentos especiais) antes do modelo. É o que sustenta as escolhas de features e a regra de não-intrusão."
        bullets={[
          "Frequência no mês atual é o sinal mais forte de churn.",
          "O scatter frequência histórica × atual isola visualmente o perfil 'cão que dorme'.",
        ]}
      />

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper)] px-6 py-16 text-center">
          <Database className="h-8 w-8 text-[var(--steel)]" aria-hidden="true" />
          <p className="text-sm text-[var(--ink-soft)]">
            Nenhum dado disponível para a análise exploratória.
          </p>
        </div>
      ) : (
        <EdaView summary={summary} />
      )}
    </div>
  );
}
