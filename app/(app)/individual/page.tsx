import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AprenderCard } from "@/components/aprender-card";
import { IndividualView } from "@/components/individual-view";
import { getScoredCustomers } from "@/lib/scoring";
import { ARCHETYPE_LABELS, TIER_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Consulta Individual" };

export default async function IndividualPage() {
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
        tease="Novo: arraste alavancas e veja o modelo recalcular o risco ao vivo, com explicação em voz."
        what="Para um membro específico, mostra o score, o waterfall SHAP (contribuição de cada variável), a explicação narrativa do agente e uma recomendação prescritiva — com botão para registrar a intervenção."
        why="Foi a melhoria pedida na avaliação: deixar claro o que pesou em cada caso, o que a operação consegue mudar e converter isso em uma ação concreta e auditável."
        bullets={[
          "Variáveis 'acionáveis' são aquelas que a operação pode influenciar (ex.: frequência, contrato).",
          "Membros 'cão que dorme' recebem um bloqueio explícito de ação proativa.",
          "Toda recomendação e intervenção é registrada no audit_log.",
        ]}
      />

      {members.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--rule)] bg-[var(--paper)] p-10 text-center">
          <p className="text-sm text-[var(--steel)]">
            Nenhum membro disponível. Popule a tabela <span className="mono">customer</span> no
            Supabase para começar.
          </p>
        </div>
      ) : (
        <IndividualView members={members} />
      )}
    </div>
  );
}
