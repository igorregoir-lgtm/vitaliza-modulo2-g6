_TEMPLATES = {
    "kmeans": {
        "Alto Risco": {
            "name": "Desistente em Risco",
            "setup": "Cliente com histórico recente de queda na frequência e contrato próximo do vencimento.",
            "conflict": "Perdeu o hábito de treinar e não encontra razão suficiente para renovar.",
            "resolution": "Segmento com maior taxa de churn observada. Alvo prioritário de retenção ativa.",
            "decision": "Contato preventivo, oferta de reativação, mapeamento de barreiras.",
            "limit": "Não é possível inferir o motivo exato da saída sem pesquisa qualitativa.",
        },
        "Risco Médio-Alto": {
            "name": "Cliente Oscilante",
            "setup": "Engajamento irregular. Frequenta, mas com intensidade variável.",
            "conflict": "Sem forte vínculo com a academia. Pode sair se houver atrito ou alternativa.",
            "resolution": "Segmento intermediário com churn acima da média. Merece atenção preventiva.",
            "decision": "Incentivar aulas em grupo, desafios e metas de curto prazo.",
            "limit": "Oscilação pode ser sazonal, não necessariamente sinal de saída.",
        },
        "Risco Médio-Baixo": {
            "name": "Frequentador Regular",
            "setup": "Usa a academia com regularidade. Contrato estável.",
            "conflict": "Risco moderado, influenciado principalmente pelo prazo do contrato.",
            "resolution": "Base saudável. Foco em manter engajamento e facilitar renovação.",
            "decision": "Comunicação proativa antes do vencimento. Oferta de fidelidade.",
            "limit": "Dados de comportamento não capturam motivações externas como mudança de cidade.",
        },
        "Baixo Risco": {
            "name": "Cliente Fiel",
            "setup": "Alta frequência, longa relação com a academia, vínculo social estabelecido.",
            "conflict": "Risco baixo, mas não nulo. Eventos externos podem impactar.",
            "resolution": "Segmento mais valioso. Preservar e usar como referência de engajamento.",
            "decision": "Programa de fidelidade, benefícios exclusivos, convite para indicação.",
            "limit": "Clientes leais podem sair por razões não capturadas na base.",
        },
        "Muito Baixo Risco": {
            "name": "Cliente Âncora",
            "setup": "Perfil com todos os fatores protetivos ativos e alta fidelidade.",
            "conflict": "Risco mínimo, mas base valiosa que deve ser ativamente cultivada.",
            "resolution": "Representam o padrão ideal de cliente. Usar como benchmark.",
            "decision": "Programa de embaixadores, benefícios premium, depoimentos.",
            "limit": "Perfil raro pode não ser escalável como estratégia de aquisição.",
        },
    },
    "supervised": {
        "Alto Risco": {
            "name": "Desistente em Risco",
            "setup": "Score de risco elevado. Combinação de fatores comportamentais desfavoráveis.",
            "conflict": "Alta probabilidade de não renovar. Sinais de distanciamento identificados.",
            "resolution": "Grupo prioritário. Intervenção de retenção tem maior impacto aqui.",
            "decision": "Abordagem proativa: ligação, oferta personalizada, incentivo de curto prazo.",
            "limit": "Alta probabilidade não é certeza. Falsos positivos existem no modelo.",
        },
        "Risco Médio": {
            "name": "Cliente na Encruzilhada",
            "setup": "Score intermediário. Pode ir para qualquer direção.",
            "conflict": "Ainda engajado, mas com sinais mistos. Período crítico de decisão.",
            "resolution": "Investimento preventivo de médio prazo. ROI moderado esperado.",
            "decision": "Comunicação personalizada. Incentivo à participação em comunidade.",
            "limit": "Intervalo de risco amplo pode incluir perfis muito distintos entre si.",
        },
        "Baixo Risco": {
            "name": "Cliente Fiel",
            "setup": "Perfil consistente com retenção. Frequência e engajamento elevados.",
            "conflict": "Risco baixo, mas não pode ser ignorado em escala.",
            "resolution": "Preservar. Custo de retenção baixo, valor ao longo do tempo alto.",
            "decision": "Programa de fidelidade. Usar como referência de padrão de sucesso.",
            "limit": "Snapshot mensal não captura variações sazonais ou eventos externos.",
        },
    },
    "baseline": {
        "Alto Risco": {
            "name": "Alerta por Regra de Negócio",
            "setup": "Perfil identificado por múltiplos critérios de risco interpretáveis.",
            "conflict": "Contrato curto + baixa frequência + lifetime recente = combinação crítica.",
            "resolution": "A baseline converge com os modelos estatísticos neste grupo.",
            "decision": "Mesmo sem modelo ML, a lógica de negócio aponta este grupo como prioritário.",
            "limit": "Regras simples podem classificar erroneamente clientes atípicos.",
        },
        "Risco Médio": {
            "name": "Monitoramento Preventivo",
            "setup": "Alguns critérios de risco presentes, compensados por fatores protetivos.",
            "conflict": "Equilíbrio instável. Uma mudança de comportamento pode deslocar para alto risco.",
            "resolution": "A baseline recomenda vigilância sem intervenção imediata de alto custo.",
            "decision": "Manter monitoramento. Acionar se frequência cair abaixo do limiar.",
            "limit": "Regras binárias não capturam nuances de engajamento individual.",
        },
        "Baixo Risco": {
            "name": "Base Segura por Regra",
            "setup": "Múltiplos fatores protetivos presentes: grupo, indicação, empresa, proximidade.",
            "conflict": "Risco baixo no momento, mas base valiosa que deve ser preservada.",
            "resolution": "A lógica de negócio confirma o que os modelos indicam: este grupo é saudável.",
            "decision": "Investir em experiência. Usar para ancorar programas de indicação.",
            "limit": "Regras não refletem variações entre contratos de mesma duração.",
        },
    },
}


def build_personas(segments: list[dict], algorithm: str) -> list[dict]:
    if algorithm == "kmeans":
        template_key = "kmeans"
    elif algorithm == "business_rules_baseline":
        template_key = "baseline"
    else:
        template_key = "supervised"

    templates = _TEMPLATES[template_key]
    personas = []

    for seg in segments:
        risk_label = seg.get("risk_label") or seg.get("label", "Baixo Risco")
        template = templates.get(risk_label, templates.get("Baixo Risco", {}))

        churn_rate = seg.get("churn_rate")
        evidence = (
            f"{round(churn_rate * 100, 1)}% de churn observado neste segmento"
            if churn_rate is not None
            else "Churn observado não calculado para este segmento."
        )

        personas.append(
            {
                "segment_label": risk_label,
                "count": seg.get("count", 0),
                "churn_rate": churn_rate,
                "name": template.get("name", "Perfil"),
                "setup": template.get("setup", ""),
                "conflict": template.get("conflict", ""),
                "resolution": template.get("resolution", ""),
                "evidence": evidence,
                "decision": template.get("decision", ""),
                "limit": template.get("limit", ""),
            }
        )

    return personas
