import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AprenderCard } from "@/components/aprender-card";
import { IndividualView } from "@/components/individual-view";
import { ContrastingCases } from "@/components/trilha/contrasting-cases";
import { getScoredCustomers } from "@/lib/scoring";
import { ARCHETYPE_LABELS, TIER_LABELS } from "@/lib/labels";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Consulta Individual" };

export default async function IndividualPage({
  searchParams,
}: {
  searchParams: Promise<{ trilha?: string }>;
}) {
  const { trilha } = await searchParams;
  const scored = await getScoredCustomers();
  const members = scored
    .sort((a, b) => b.prediction.churn_probability - a.prediction.churn_probability)
    .map((s) => ({
      id: s.customer.external_ref,
      label: `${s.customer.external_ref} · ${TIER_LABELS[s.prediction.risk_tier]} · ${ARCHETYPE_LABELS[s.prediction.archetype]}`,
    }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Customer Success"
        title="Consulta Individual"
        description="Explicação caso a caso: quais variáveis pesaram, quais são acionáveis e qual ação de retenção tomar."
      />

      <AprenderCard
        screen="Consulta Individual"
        title="Da explicação à ação"
        tease="Novo: clique em &quot;Simular esta alavanca&quot; e assista o risco recalcular ao vivo, com a explicação do tutor em texto — ou arraste as alavancas você mesmo."
        what="Para um membro específico, mostra o score, o waterfall SHAP (contribuição de cada variável), a explicação narrativa do agente e uma recomendação prescritiva — com botão para registrar a intervenção."
        why="Foi a melhoria pedida na avaliação: deixar claro o que pesou em cada caso, o que a operação consegue mudar e converter isso em uma ação concreta e auditável."
        bullets={[
          "Variáveis 'acionáveis' são aquelas que a operação pode influenciar (ex.: frequência, contrato).",
          "Membros 'cão que dorme' recebem um bloqueio explícito de ação proativa.",
          "Toda recomendação e intervenção é registrada no audit_log.",
        ]}
      />

      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--rule)] bg-[var(--paper-soft)] px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cloud)] text-[var(--steel)]">
            <Users className="h-6 w-6" />
          </span>
          <div className="max-w-sm">
            <p className="text-sm font-medium text-[var(--ink-soft)]">
              Nenhum membro disponível
            </p>
            <p className="mt-1 text-xs text-[var(--steel)]">
              Popule a tabela <span className="mono">customer</span> no Supabase para começar a
              explorar os scores.
            </p>
          </div>
        </div>
      ) : (
        <>
          <IndividualView members={members} />
          {trilha === "explicar" && <ContrastingCases members={members} />}
        </>
      )}
    </div>
  );
}
