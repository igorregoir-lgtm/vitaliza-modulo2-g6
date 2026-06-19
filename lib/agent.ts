// ============================================================================
// IA Agent core — OpenRouter chat completions, SERVER ONLY.
// Two modes: 'tutor' (educational/empático, PBL) and 'advisor' (Function A
// narrative + Function B prescriptive recommendation). Hard guardrails live
// both in the system prompt AND in code (see runAdvisor).
//
// NEVER expose OPENROUTER_API_KEY to the client. This module is server-only.
// ============================================================================

import "server-only";
import { ARCHETYPE_LABELS, featureLabel, TIER_LABELS } from "@/lib/labels";
import type { AdvisorResult, PredictResult, Recommendation } from "@/lib/types";

// ---- Business guardrail constants ----
export const MAX_DISCOUNT_PCT = 20; // never propose a discount above this cap
export const MAX_CHANNELS = 2; // max 2 channels per customer

const ALLOWED_CHANNELS = ["e-mail", "whatsapp", "push", "ligacao", "sms"];

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOpenRouter(messages: OpenRouterMessage[], maxTokens = 700): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY ausente no servidor.");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Vitaliza Retencao",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// TUTOR MODE — educational, empathetic, PBL.
// ---------------------------------------------------------------------------
const TUTOR_SYSTEM = `Você é o tutor pedagógico da Vitaliza, um sistema de inteligência de retenção.
Seu papel é EDUCAR com empatia (metodologia PBL): explique o "como" e o "porquê" de cada conceito
e tela do sistema em português do Brasil, com tom acolhedor, linguagem acessível e SEM jargão técnico.
Quando precisar usar um termo técnico (ex.: SHAP, churn, AUC), explique-o em uma frase simples.
Seja conciso (no máximo ~180 palavras), use analogias do dia a dia quando ajudar, e nunca seja condescendente.
Regra importante: explicabilidade descreve o COMPORTAMENTO DO MODELO, não relações de causa e efeito do mundo real.`;

export async function runTutor(question: string, context?: string): Promise<string> {
  const userMsg = context ? `Contexto da tela:\n${context}\n\nPergunta do usuário:\n${question}` : question;
  return callOpenRouter(
    [
      { role: "system", content: TUTOR_SYSTEM },
      { role: "user", content: userMsg },
    ],
    600,
  );
}

// ---------------------------------------------------------------------------
// ADVISOR MODE — Function A (narrative) + Function B (recommendation).
// ---------------------------------------------------------------------------
const ADVISOR_SYSTEM = `Você é o consultor de retenção da Vitaliza. Você recebe dados de um membro
(score de risco, arquétipo e os principais fatores SHAP) e produz DUAS coisas em português do Brasil:

FUNÇÃO A — Explicação narrativa (campo "narrative"):
- No máximo 150 palavras, sem jargão.
- Explique por que o membro está nesse nível de risco, quais variáveis pesaram e quais são acionáveis.
- GUARDRAIL OBRIGATÓRIO: NUNCA afirme causalidade. Os valores SHAP descrevem o comportamento do MODELO,
  não relações de causa e efeito do mundo real. Use formulações como "o modelo associou", "pesou no cálculo".

FUNÇÃO B — Recomendação prescritiva (campo "recommendation"):
- Uma oferta personalizada e acionável: { offer, channel, copy, timing }.
- GUARDRAILS OBRIGATÓRIOS:
  * NUNCA proponha desconto acima de ${MAX_DISCOUNT_PCT}%.
  * No máximo ${MAX_CHANNELS} canais ("channel" é uma lista). Canais válidos: ${ALLOWED_CHANNELS.join(", ")}.
  * A copy deve ser empática, curta e respeitosa.
  * Respeite a segmentação prévia (arquétipo informado).

Responda ESTRITAMENTE em JSON válido com este formato:
{"narrative": "...", "recommendation": {"offer": "...", "channel": ["e-mail"], "copy": "...", "timing": "..."}}
Não inclua texto fora do JSON.`;

function summarizeDrivers(pred: PredictResult): string {
  return pred.top_drivers
    .slice(0, 5)
    .map((d) => {
      const dir = d.direction === "up" ? "aumenta o risco" : "reduz o risco";
      const act = d.actionable ? "acionável" : "não-acionável";
      return `- ${featureLabel(d.feature)} = ${d.value} (SHAP ${d.shap_value.toFixed(3)}, ${dir}, ${act})`;
    })
    .join("\n");
}

/** Clamp the LLM recommendation against the hard code-level guardrails. */
function sanitizeRecommendation(rec: Recommendation | null): Recommendation | null {
  if (!rec) return null;
  let channel = Array.isArray(rec.channel) ? rec.channel : [String(rec.channel)];
  channel = channel
    .map((c) => String(c).toLowerCase().trim())
    .filter((c) => ALLOWED_CHANNELS.some((a) => c.includes(a) || a.includes(c)))
    .slice(0, MAX_CHANNELS);
  if (channel.length === 0) channel = ["e-mail"];

  // Cap any discount mentioned in offer/copy above the cap.
  const capDiscount = (text: string) =>
    text.replace(/(\d{1,3})\s?%/g, (m, p1) => {
      const v = Number(p1);
      return v > MAX_DISCOUNT_PCT ? `${MAX_DISCOUNT_PCT}%` : m;
    });

  return {
    offer: capDiscount(String(rec.offer ?? "")),
    channel,
    copy: capDiscount(String(rec.copy ?? "")),
    timing: String(rec.timing ?? ""),
  };
}

export interface AdvisorInput {
  pred: PredictResult;
  externalRef: string;
}

/**
 * Run the advisor. CODE-LEVEL guardrail: if archetype is 'sleeping_dog' OR
 * proactive_allowed === false, refuse to generate a proactive offer and return
 * the non-intrusion explanation instead — without ever calling the LLM for an
 * offer.
 */
export async function runAdvisor({ pred, externalRef }: AdvisorInput): Promise<AdvisorResult> {
  // HARD GUARDRAIL — "don't wake the sleeping dog".
  if (pred.archetype === "sleeping_dog" || pred.proactive_allowed === false) {
    return {
      blocked: true,
      blocked_reason:
        "Membro com vínculo longo e uso baixíssimo (perfil 'cão que dorme'). Pela política de não-intrusão, ele é excluído de qualquer campanha proativa: contatá-lo tende a antecipar o cancelamento em vez de evitá-lo.",
      narrative:
        `O modelo classificou o membro ${externalRef} como '${ARCHETYPE_LABELS[pred.archetype]}', ` +
        `com risco ${TIER_LABELS[pred.risk_tier]} (${(pred.churn_probability * 100).toFixed(1)}%). ` +
        "Nesse perfil, a recomendação correta é NÃO intervir proativamente. Monitore passivamente e " +
        "responda apenas se o próprio membro buscar contato. Os fatores abaixo descrevem o que pesou no " +
        "cálculo do modelo — não relações de causa e efeito.",
      recommendation: null,
    };
  }

  const userMsg = `Membro: ${externalRef}
Risco: ${TIER_LABELS[pred.risk_tier]} (${(pred.churn_probability * 100).toFixed(1)}% de probabilidade de churn)
Arquétipo: ${ARCHETYPE_LABELS[pred.archetype]}
Versão do modelo: ${pred.model_version}

Principais fatores SHAP (descrevem o modelo, não o mundo):
${summarizeDrivers(pred)}

Gere a explicação narrativa (Função A) e a recomendação prescritiva (Função B).`;

  const raw = await callOpenRouter(
    [
      { role: "system", content: ADVISOR_SYSTEM },
      { role: "user", content: userMsg },
    ],
    800,
  );

  let parsed: { narrative?: string; recommendation?: Recommendation | null } = {};
  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  } catch {
    // Fall back to using the raw text as the narrative if JSON parse fails.
    parsed = { narrative: raw, recommendation: null };
  }

  return {
    blocked: false,
    narrative: parsed.narrative ?? raw,
    recommendation: sanitizeRecommendation(parsed.recommendation ?? null),
  };
}

/** Deterministic offline fallback advisor when the LLM is unavailable. */
export function fallbackAdvisor({ pred, externalRef }: AdvisorInput): AdvisorResult {
  if (pred.archetype === "sleeping_dog" || pred.proactive_allowed === false) {
    return {
      blocked: true,
      blocked_reason:
        "Perfil 'cão que dorme': excluído de campanhas proativas pela política de não-intrusão.",
      narrative:
        `Membro ${externalRef}: o modelo o classificou como '${ARCHETYPE_LABELS[pred.archetype]}'. ` +
        "Não há ação proativa recomendada.",
      recommendation: null,
    };
  }

  const top = pred.top_drivers.filter((d) => d.actionable).slice(0, 3);
  const factors = top.map((d) => featureLabel(d.feature)).join(", ");

  const byArch: Record<string, Recommendation> = {
    early_dropper: {
      offer: "Sessão de onboarding guiada + 1 aula experimental sem custo",
      channel: ["whatsapp", "e-mail"],
      copy: "Vimos que você começou agora! Que tal uma aula experimental para encontrar o que combina com você?",
      timing: "Próximas 48h",
    },
    desengajado_conteudo: {
      offer: "Convite para 2 desafios em grupo da próxima semana",
      channel: ["push", "e-mail"],
      copy: "Sentimos sua falta nas aulas. Preparamos desafios novos que podem reacender sua rotina.",
      timing: "Início da próxima semana",
    },
    preco_sensivel: {
      offer: `Upgrade para plano semestral com ${MAX_DISCOUNT_PCT}% no primeiro ciclo`,
      channel: ["e-mail", "whatsapp"],
      copy: "Um plano um pouco mais longo sai mais em conta por mês — montamos uma condição especial para você.",
      timing: "Antes do fim do contrato atual",
    },
    concorrente_driven: {
      offer: "Benefício exclusivo de fidelidade + acesso antecipado a novas aulas",
      channel: ["e-mail"],
      copy: "Queremos que você fique com a gente: liberamos um benefício exclusivo de fidelidade para você.",
      timing: "Esta semana",
    },
  };

  const rec = byArch[pred.archetype] ?? byArch.concorrente_driven;

  return {
    blocked: false,
    narrative:
      `O modelo estimou risco ${TIER_LABELS[pred.risk_tier]} (${(pred.churn_probability * 100).toFixed(1)}%) ` +
      `para o membro ${externalRef}, no arquétipo '${ARCHETYPE_LABELS[pred.archetype]}'. ` +
      `Os fatores acionáveis que mais pesaram no cálculo do modelo foram: ${factors || "frequência de uso"}. ` +
      "Vale lembrar que essa leitura descreve o comportamento do modelo, não uma relação de causa e efeito.",
    recommendation: rec,
  };
}

// ---------------------------------------------------------------------------
// CAPSTONE — resumo executivo da jornada (Trilha de Aprendizado, #6).
// Sintetiza a trilha numa estratégia de retenção, em tom executivo. Reusa o
// LLM do advisor; degrada para um texto determinístico sem a chave.
// ---------------------------------------------------------------------------
export interface CapstoneInput {
  /** Taxa-base de churn observada (0..1). */
  baseRate: number;
  /** Membros analisados na base. */
  n: number;
  /** O que o aprendiz percorreu (títulos das missões concluídas). */
  highlights: string[];
}

const CAPSTONE_SYSTEM = `Você é o tutor da Vitaliza ajudando o aprendiz a SINTETIZAR, em tom executivo e
acolhedor, a jornada que ele acabou de percorrer — transformando-a numa estratégia de retenção.
Escreva em português do Brasil, no máximo ~200 palavras, sem jargão técnico (explique qualquer termo
em uma frase). Estruture como um breve memorando para a liderança, cobrindo: (1) o tamanho do problema
de churn; (2) como o modelo ajuda — risco por membro + explicação local (SHAP); (3) a decisão de ação
custo-consciente, incluindo quando NÃO intervir (perfil 'cão que dorme', não-intrusão); (4) a escolha
do corte/limiar guiada por ROI, não por recall; (5) um fechamento conectando tudo a receita preservada.
Comece exatamente com: "Você desenhou uma estratégia de retenção orientada por dados." Use os dados
fornecidos. Inclua UMA vez o lembrete: a explicabilidade descreve o comportamento do modelo, não
relações de causa e efeito.
Escreva em PROSA CORRIDA (parágrafos curtos), SEM marcação markdown: nada de '#', '**', '---',
títulos ou listas com marcadores. Apenas texto.`;

function capstoneUserMsg({ baseRate, n, highlights }: CapstoneInput): string {
  const pct = `${Math.round(baseRate * 100)}%`;
  const done = highlights.length > 0 ? highlights.join("; ") : "a trilha completa";
  return `Dados da jornada:
- Base analisada: ${n} membros.
- Taxa-base de cancelamento observada: ${pct}.
- Etapas percorridas pelo aprendiz: ${done}.

Gere o resumo executivo da estratégia de retenção.`;
}

export async function runCapstoneSummary(input: CapstoneInput): Promise<string> {
  return callOpenRouter(
    [
      { role: "system", content: CAPSTONE_SYSTEM },
      { role: "user", content: capstoneUserMsg(input) },
    ],
    600,
  );
}

/** Resumo determinístico (sem LLM) — mesmo arco do prompt. */
export function fallbackCapstoneSummary({ baseRate, n, highlights }: CapstoneInput): string {
  const pct = `${Math.round(baseRate * 100)}%`;
  const steps =
    highlights.length > 0
      ? `Você percorreu: ${highlights.join("; ")}. `
      : "";
  return (
    "Você desenhou uma estratégia de retenção orientada por dados.\n\n" +
    `O problema tem tamanho: numa base de ${n} membros analisados, a taxa-base de cancelamento ` +
    `observada é de ${pct} — alta o bastante para justificar agir, mas não tão alta que baste ` +
    "'chutar'. É exatamente onde um modelo de risco compensa.\n\n" +
    "Como o modelo ajuda: ele estima o risco de cada membro e, com a explicação local (SHAP), mostra " +
    "quais variáveis pesaram naquele caso e quais a operação consegue mudar — uma leitura do " +
    "comportamento do modelo, não de causa e efeito do mundo real.\n\n" +
    "A decisão de ação é custo-consciente: cada recomendação respeita orçamento e canais, e há casos " +
    "em que a melhor decisão é NÃO intervir — o perfil 'cão que dorme' (vínculo longo, uso quase zero) " +
    "fica fora das campanhas proativas por política de não-intrusão.\n\n" +
    "No nível do sistema, o corte de decisão é escolhido pelo ROI — equilibrando churns capturados e " +
    "contatos desperdiçados — e não apenas pelo recall. " +
    steps +
    "Fechando o ciclo, cada membro retido preserva receita: é assim que o risco do modelo vira valor de negócio."
  );
}
