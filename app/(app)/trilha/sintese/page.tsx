import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ExecutiveSummary } from "@/components/trilha/executive-summary";

export const metadata: Metadata = { title: "Síntese da estratégia" };

export default function SintesePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Criar · capstone"
        title="Síntese da estratégia"
        description="O fechamento da trilha: tudo o que você percorreu, reunido em uma estratégia de retenção pronta para apresentar à liderança."
      />
      <ExecutiveSummary />
    </div>
  );
}
