import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ShieldCheck, ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Separator } from "@/components/ui/separator";
import type { PrincipiosContent } from "@/lib/types";

export const metadata: Metadata = {
  title: "Princípios de Personalização",
  description:
    "Como usamos dados de comportamento para reduzir o churn de forma transparente, proporcional e contestável (LGPD / ANPD 07/2025).",
};

// Fallback mirrors the seed in the init migration so the page renders even if
// the DB read fails or RLS is unexpectedly restrictive.
const FALLBACK: PrincipiosContent = {
  titulo: "Princípios de Personalização",
  resumo:
    "Como usamos dados de comportamento para reduzir o churn de forma transparente, proporcional e contestável.",
  base_legal:
    "LGPD (Lei 13.709/2018) e Nota Técnica ANPD 07/2025 sobre transparência em decisões automatizadas.",
  principios: [
    {
      nome: "Finalidade",
      texto:
        "Os dados comportamentais (frequência de uso, tipo de contrato, tempo de assinatura, participação em desafios) são usados exclusivamente para estimar risco de cancelamento e oferecer ações de retenção úteis ao usuário.",
    },
    {
      nome: "Transparência",
      texto:
        "Toda previsão é explicável: mostramos quais variáveis pesaram e em que direção. As explicações descrevem o comportamento do modelo, não relações de causa e efeito.",
    },
    {
      nome: "Proporcionalidade",
      texto:
        "No máximo 2 canais de contato simultâneos por pessoa; nenhuma oferta de desconto sem segmentação prévia.",
    },
    {
      nome: "Não-intrusão",
      texto:
        "Usuários de baixíssimo uso e vínculo longo (perfil “cão que dorme”) são excluídos de qualquer campanha proativa, para respeitar quem não quer ser contatado.",
    },
    {
      nome: "Contestação",
      texto:
        "Qualquer pessoa pode solicitar revisão humana de uma decisão automatizada e a exclusão de seus dados do processo de personalização.",
    },
    {
      nome: "Auditabilidade",
      texto:
        "Cada previsão e cada ação ficam registradas (entrada anonimizada, score, versão do modelo, explicação, decisão) para auditoria e melhoria contínua.",
    },
  ],
};

async function getPrincipios(): Promise<PrincipiosContent> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("principios").select("conteudo").eq("id", 1).maybeSingle();
    if (data?.conteudo) return data.conteudo as PrincipiosContent;
  } catch {
    /* fall through to FALLBACK */
  }
  return FALLBACK;
}

export default async function PrincipiosPage() {
  const c = await getPrincipios();

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Dark ink header */}
      <header className="border-b border-[var(--primary-deep)] bg-[var(--ink)] text-[var(--paper)]">
        <div className="relative mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <p className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap font-display text-base font-semibold tracking-tight text-[var(--paper)] md:block">
            Sistema de Inteligência de Retenção
          </p>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
              <Activity className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-semibold">Vitaliza</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--cloud)] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </Link>
        </div>
      </header>

      {/* Faixa central — identidade + proposta de valor (em todas as páginas) */}
      <div className="border-b border-[var(--rule)] bg-[var(--paper-soft)]">
        <div className="mx-auto max-w-3xl px-6 py-2.5 text-center">
          <p className="text-xs leading-relaxed text-[var(--steel)]">
            Risco de churn por usuário, explicação individual com SHAP e recomendação prescritiva,
            tudo auditável de ponta a ponta.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="eyebrow mb-2 flex items-center gap-2 text-[var(--accent-deep)]">
          <ShieldCheck className="h-4 w-4" />
          Página pública · LGPD
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.titulo}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">{c.resumo}</p>

        <Separator className="my-8" />

        <ol className="flex flex-col gap-6">
          {c.principios.map((p, i) => (
            <li key={p.nome} className="flex gap-4">
              <span className="mono mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--rule)] text-xs text-[var(--steel)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="text-lg font-semibold">{p.nome}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        <Separator className="my-8" />

        <div className="rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper-soft)] p-5">
          <p className="eyebrow mb-1.5">Base legal</p>
          <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{c.base_legal}</p>
        </div>

        <p className="mt-10 text-center text-xs text-[var(--steel)]">
          Para exercer seus direitos (revisão humana, exclusão de dados), procure o canal de
          atendimento.
        </p>
      </main>
    </div>
  );
}
