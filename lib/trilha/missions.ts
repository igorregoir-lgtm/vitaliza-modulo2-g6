// ============================================================================
// Trilha de Aprendizado — fonte ÚNICA de verdade das 6 estações (Bloom).
// Alimenta a capa (trilha-map), o painel-guia (guide-rail) e o check formativo
// (station-check). Sem lógica de UI aqui — só dados.
// See docs/superpowers/specs/2026-06-19-trilha-aprendizado-design.md §3, §5.
// ============================================================================

export type MissionId =
  | "entender"
  | "explicar"
  | "simular"
  | "decidir"
  | "avaliar"
  | "sintese";

/** Degrau da taxonomia de Bloom (pt-BR). */
export type BloomLevel = "Entender" | "Analisar" | "Aplicar" | "Avaliar" | "Criar";

export interface CheckOption {
  text: string;
  correct: boolean;
  /** Feedback formativo — ensina, mesmo quando a resposta está errada. */
  feedback: string;
}

export interface MissionCheck {
  /** Pergunta de recuperação / predict-first (1 por missão na v1). */
  prompt: string;
  options: CheckOption[];
}

export interface Mission {
  id: MissionId;
  order: number; // 1..6
  bloom: BloomLevel;
  title: string;
  /** Verbo curto do degrau (eyebrow). */
  verb: string;
  /** Tela-alvo com o parâmetro que liga o painel-guia. */
  href: string;
  /** Aprofundamento opcional (camada "fundo") — exploração livre do tema. */
  deepenHref?: string;
  /** O que se explora ao aprofundar (1 frase). */
  deepenHint?: string;
  /** 1 frase: o que o aprendiz vai conseguir fazer. */
  objective: string;
  /** O que fazer NESTA tela (guia; mais detalhado nas primeiras missões). */
  instruction: string;
  /** Pergunta-semente para o tutor inline. */
  tutorSeed: string;
  check: MissionCheck;
  /** Estimativa de minutos (soma ≈ tour curto). */
  estMin: number;
}

export const MISSIONS: Mission[] = [
  {
    id: "entender",
    order: 1,
    bloom: "Entender",
    title: "Entender o problema",
    verb: "Entender",
    href: "/dashboard?trilha=entender",
    deepenHref: "/eda",
    deepenHint: "Explore por conta própria as 6 visualizações do dataset (churn por contrato, sobrevivência, frequência, correlação).",
    objective: "Dimensionar o tamanho e o custo do churn antes de agir.",
    instruction:
      "Olhe os indicadores no topo: o churn mensal está em 10,2% (a meta é 6,0%). Cada cancelamento tem um custo. Role até o simulador de ROI e veja, em reais, quanto a retenção pode preservar.",
    tutorSeed:
      "Explique de forma simples o que é churn e por que 10,2% de cancelamento ao mês é um problema grave para uma academia.",
    check: {
      prompt:
        "No conjunto de dados usado para treinar o modelo, que fração dos membros acabou cancelando (a 'taxa-base')?",
      options: [
        {
          text: "Cerca de 26% — pouco mais de 1 em cada 4.",
          correct: true,
          feedback:
            "Isso. A taxa-base do dataset é 26,5%. Guarde esse número: um modelo só é útil se acerta mais do que simplesmente 'chutar a taxa-base'.",
        },
        {
          text: "Cerca de 50% — metade dos membros.",
          correct: false,
          feedback:
            "Não — seria quase um cara-ou-coroa. A taxa-base real do dataset é 26,5%, e é por isso que prever churn bem exige um modelo, não um chute.",
        },
        {
          text: "Cerca de 5% — quase ninguém cancela.",
          correct: false,
          feedback:
            "Mais alto que isso: a taxa-base do dataset é 26,5%. O churn mensal do case (10,2%) é outra métrica — cuidado para não confundir as duas.",
        },
      ],
    },
    estMin: 2,
  },
  {
    id: "explicar",
    order: 2,
    bloom: "Analisar",
    title: "Explicar um caso",
    verb: "Explicar",
    href: "/individual?trilha=explicar",
    deepenHref: "/individual",
    deepenHint: "Abra qualquer membro da base e leia o waterfall SHAP livremente, sem roteiro.",
    objective: "Ler, para um membro específico, por que o modelo o considera em risco.",
    instruction:
      "Escolha um membro de risco alto. Olhe o waterfall SHAP: cada barra é uma variável empurrando o risco para cima ou para baixo. As 'acionáveis' são as que a operação consegue mudar.",
    tutorSeed:
      "O que é o gráfico de waterfall SHAP e como eu leio a contribuição de cada variável para um membro específico?",
    check: {
      prompt:
        "No waterfall SHAP de um membro, uma barra que empurra o risco PARA CIMA significa que…",
      options: [
        {
          text: "…aquela variável, no valor desse membro, fez o modelo aumentar a probabilidade de churn estimada.",
          correct: true,
          feedback:
            "Exato. O SHAP decompõe a previsão: a barra mostra quanto aquela variável moveu o score DESTE membro — comportamento do modelo, não causa e efeito do mundo real.",
        },
        {
          text: "…aquela variável causou o cancelamento do membro.",
          correct: false,
          feedback:
            "Cuidado: o SHAP descreve o que pesou no cálculo do MODELO, não uma relação de causa e efeito real. Essa distinção é o guardrail central do sistema.",
        },
        {
          text: "…a variável é irrelevante para esse membro.",
          correct: false,
          feedback:
            "Ao contrário — quanto maior a barra, mais aquela variável pesou na previsão desse membro.",
        },
      ],
    },
    estMin: 2,
  },
  {
    id: "simular",
    order: 3,
    bloom: "Aplicar",
    title: "Simular uma intervenção",
    verb: "Simular",
    href: "/individual?trilha=simular",
    deepenHref: "/individual",
    deepenHint: "Use o simulador livre: arraste todas as alavancas e compare cenários sem o passo a passo.",
    objective: "Testar intervenções e ver o modelo recalcular o risco ao vivo.",
    instruction:
      "Tente você primeiro: no card 'Simule uma intervenção', arraste a frequência de aulas para cima e observe o score, o waterfall e o arquétipo mudarem. Só depois clique em 'Simular esta alavanca' para ver a sugestão do otimizador.",
    tutorSeed:
      "Como o simulador projeta um novo risco quando eu mudo uma alavanca, e por que ele é honesto (ancorado no score real do modelo)?",
    check: {
      prompt:
        "Você aumenta a frequência de aulas de um membro em risco. O que o simulador faz com o risco projetado?",
      options: [
        {
          text: "Reduz o risco — e ainda pode mudar o arquétipo do membro.",
          correct: true,
          feedback:
            "Isso. Mais frequência é o sinal mais forte contra o churn no modelo transparente; ela recalcula a razão de frequência e pode 'virar' o arquétipo ao vivo.",
        },
        {
          text: "Aumenta o risco.",
          correct: false,
          feedback:
            "Não — frequência baixa é o maior empurrão para o churn. Subi-la reduz o risco projetado.",
        },
        {
          text: "Não muda nada: o score é fixo.",
          correct: false,
          feedback:
            "Muda sim, ao vivo. O delta vem do modelo transparente, ancorado no score real do XGBoost — uma projeção honesta.",
        },
      ],
    },
    estMin: 2,
  },
  {
    id: "decidir",
    order: 4,
    bloom: "Avaliar",
    title: "Decidir a ação",
    verb: "Decidir",
    href: "/individual?trilha=decidir",
    deepenHref: "/carteira",
    deepenHint: "Decida no nível da carteira: ordene por risco, filtre por arquétipo e veja o bloqueio dos 'cães que dormem'.",
    objective:
      "Transformar a leitura do modelo em uma ação de retenção custo-consciente — e saber quando NÃO agir.",
    instruction:
      "Role até 'Explicação narrativa e recomendação' e gere a recomendação. Avalie: a oferta cabe no orçamento? O canal respeita o membro? Repare que membros 'cão que dorme' recebem um bloqueio explícito de ação proativa.",
    tutorSeed:
      "Por que às vezes a melhor decisão é NÃO contatar um membro em risco (a regra do 'cão que dorme')?",
    check: {
      prompt:
        "O modelo aponta um membro 'cão que dorme' (vínculo longo, uso quase zero) como em risco. A decisão correta é…",
      options: [
        {
          text: "Não intervir proativamente — contatá-lo tende a antecipar o cancelamento.",
          correct: true,
          feedback:
            "Exato. É a política de não-intrusão: para esse perfil, 'cutucar' costuma lembrar a pessoa de cancelar. O sistema bloqueia a ação proativa por código.",
        },
        {
          text: "Oferecer o maior desconto possível imediatamente.",
          correct: false,
          feedback:
            "Não. Para o 'cão que dorme', qualquer contato proativo tende a acelerar o churn — e o sistema ainda limita descontos a 20%.",
        },
        {
          text: "Ligar todos os dias até ele responder.",
          correct: false,
          feedback:
            "Isso violaria a não-intrusão e provavelmente causaria o cancelamento. Esse perfil fica em monitoramento passivo.",
        },
      ],
    },
    estMin: 2,
  },
  {
    id: "avaliar",
    order: 5,
    bloom: "Avaliar",
    title: "Avaliar o sistema",
    verb: "Avaliar",
    href: "/trilha/avaliar?trilha=avaliar",
    deepenHref: "/principios-de-personalizacao",
    deepenHint: "Aprofunde a ética e a governança: a página pública de princípios de personalização (LGPD).",
    objective:
      "Avaliar o sistema como um todo: onde colocar o corte de decisão e o quanto confiar no modelo.",
    instruction:
      "Mexa no corte (threshold): um corte baixo pega quase todos os churns (recall alto) mas gera muitos falsos positivos (caro); um corte alto poupa contatos mas deixa churns passarem. Procure o corte que maximiza o ROI — não o que maximiza o recall.",
    tutorSeed:
      "O que é o limiar (threshold) de decisão e por que o melhor corte é o que maximiza ROI, e não o recall?",
    check: {
      prompt:
        "Você baixa o corte de decisão para 'não perder nenhum churn'. O efeito colateral é…",
      options: [
        {
          text: "Muitos falsos positivos: você contata gente que não ia cancelar, gastando recurso à toa.",
          correct: true,
          feedback:
            "Isso. O recall sobe, mas a precisão cai e o custo explode. Por isso escolhemos o corte pelo ROI, equilibrando churns pegos × contatos desperdiçados.",
        },
        {
          text: "Nada muda: o modelo é o mesmo.",
          correct: false,
          feedback:
            "O modelo é o mesmo, mas o CORTE muda quem é marcado como risco — e isso muda recall, falsos positivos e custo.",
        },
        {
          text: "O recall cai.",
          correct: false,
          feedback:
            "Ao contrário: baixar o corte aumenta o recall (pega mais churns), ao custo de mais falsos positivos.",
        },
      ],
    },
    estMin: 3,
  },
  {
    id: "sintese",
    order: 6,
    bloom: "Criar",
    title: "Sintetizar a estratégia",
    verb: "Sintetizar",
    href: "/trilha/sintese?trilha=sintese",
    objective: "Sintetizar tudo em uma estratégia de retenção — e comunicá-la para a liderança.",
    instruction:
      "Gere o resumo executivo: ele junta o que você percorreu em uma narrativa de estratégia, pronta para imprimir ou salvar em PDF.",
    tutorSeed:
      "Como resumir uma estratégia de retenção orientada por dados para uma liderança não-técnica?",
    check: {
      prompt: "Qual a melhor forma de apresentar essa estratégia para um CFO?",
      options: [
        {
          text: "Conectar o risco do modelo a impacto em reais (receita preservada, ROI) e às decisões de ação.",
          correct: true,
          feedback:
            "Isso. A liderança decide por números de negócio: score → receita preservada → ROI. É o fio que costura a trilha inteira.",
        },
        {
          text: "Mostrar apenas a acurácia e o AUC do modelo.",
          correct: false,
          feedback:
            "Métricas de modelo importam, mas não convencem um CFO sozinhas. Traduza para impacto financeiro e decisão.",
        },
        {
          text: "Pedir orçamento sem mostrar o retorno esperado.",
          correct: false,
          feedback:
            "Sem ROI não há caso de negócio. A síntese precisa conectar a ação ao retorno.",
        },
      ],
    },
    estMin: 2,
  },
];

export const TRILHA_TOTAL = MISSIONS.length;

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Soma das estimativas — usado na capa ("tour de ~N min"). */
export const TRILHA_EST_MIN = MISSIONS.reduce((s, m) => s + m.estMin, 0);
