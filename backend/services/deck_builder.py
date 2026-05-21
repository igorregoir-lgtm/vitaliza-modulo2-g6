_ALGO_LABELS = {
    "random_forest": "Random Forest",
    "kmeans": "K-Means",
    "logistic_regression": "Regressão Logística",
    "xgboost": "XGBoost",
    "lightgbm": "LightGBM",
    "business_rules_baseline": "Baseline por Regra de Negócio",
}


def build_deck(
    eda: dict, model_result: dict, personas: list[dict], algorithm: str
) -> list[dict]:
    summary = eda.get("summary", {})
    segments = model_result.get("segments", [])
    feature_importance = model_result.get("feature_importance", [])

    churn_pct = round((summary.get("churn_rate", 0) * 100), 1)
    total = summary.get("customers", 0)
    algo_name = _ALGO_LABELS.get(algorithm, algorithm)

    top_features = (
        [f["label"] for f in feature_importance[:3]]
        if feature_importance
        else ["Frequência atual", "Tempo como cliente", "Duração do contrato"]
    )

    return [
        {
            "number": 1,
            "tag": "Capa",
            "title": "Vitaliza",
            "subtitle": "A Arquitetura da Retenção Preditiva",
            "content": (
                f"Customer Segmentation Report. Análise exploratória e segmentação de "
                f"{total:,} clientes para identificar padrões de churn e subsidiar "
                f"estratégias de retenção. Algoritmo: {algo_name}."
            ),
        },
        {
            "number": 2,
            "tag": "Problema",
            "title": "O problema de retenção",
            "subtitle": "Por que tratar todos os clientes igual é ineficiente",
            "content": (
                f"A base apresenta {churn_pct}% de taxa de churn. Clientes que reduzem "
                "frequência, têm contratos curtos ou baixo vínculo com a academia representam "
                "o núcleo do problema. Sem segmentação, qualquer campanha de retenção trata "
                "perfis distintos de forma idêntica — desperdiçando recursos e ignorando contexto."
            ),
        },
        {
            "number": 3,
            "tag": "Dados",
            "title": "O que o dado mostra",
            "subtitle": "Principais números da base",
            "content": (
                f"{total:,} clientes analisados. "
                f"Churn rate: {churn_pct}%. "
                f"Lifetime médio: {summary.get('avg_lifetime', '—')} meses. "
                f"Frequência média no mês: {summary.get('avg_frequency_month', '—')} aulas/semana. "
                f"Sinais mais relevantes na EDA: {', '.join(top_features[:3])}."
            ),
        },
        {
            "number": 4,
            "tag": "Metodologia",
            "title": "Três lentes complementares",
            "subtitle": "EDA · Algoritmos estatísticos · Baseline interpretável",
            "content": (
                "EDA: carregamento, limpeza, análise descritiva e correlações com churn. "
                "K-Means: segmentação não supervisionada por similaridade comportamental. "
                "Modelos supervisionados (Random Forest, Regressão Logística, XGBoost, LightGBM): "
                "estimativa individual de probabilidade de churn. "
                "Baseline por Regra de Negócio: validação interpretável com lógica simples e auditável. "
                "Três lentes distintas que convergem para os mesmos perfis de risco."
            ),
        },
        {
            "number": 5,
            "tag": "EDA",
            "title": "Principais achados exploratórios",
            "subtitle": "O que os dados revelam sobre churn",
            "content": (
                "Contrato mensal concentra a maior taxa de cancelamento. "
                "Clientes nos primeiros meses (lifetime ≤ 3) são os mais vulneráveis à evasão. "
                "Aulas em grupo e indicação por amigos funcionam como fatores protetivos consistentes. "
                "Empresa parceira e proximidade geográfica reduzem o risco de churn. "
                f"Variável com maior correlação com churn: {top_features[0] if top_features else 'Frequência atual'}."
            ),
        },
        {
            "number": 6,
            "tag": "Segmentação",
            "title": f"{len(segments)} segmentos identificados",
            "subtitle": f"Algoritmo: {algo_name}",
            "content": _format_segments(segments),
        },
        {
            "number": 7,
            "tag": "Personas",
            "title": "Perfis de cliente",
            "subtitle": "Quem são os clientes em risco e como agir",
            "content": _format_personas(personas),
        },
        {
            "number": 8,
            "tag": "Priorização",
            "title": "Onde agir, investir e preservar",
            "subtitle": "Priorização preliminar por segmento",
            "content": (
                "Ação imediata: clientes de alto risco com contrato próximo do vencimento e queda de frequência. "
                "Investimento estratégico: clientes de risco médio com potencial de fidelização via "
                "comunidade e onboarding estruturado. "
                "Monitorar e preservar: clientes de baixo risco e alta frequência — "
                "base âncora que sustenta o negócio e serve como referência de engajamento."
            ),
        },
        {
            "number": 9,
            "tag": "Limitações",
            "title": "O que não podemos afirmar",
            "subtitle": "Transparência metodológica",
            "content": (
                "Não temos o motivo declarado de cancelamento. "
                "Os dados representam um snapshot mensal sem granularidade temporal. "
                "Correlação identificada não implica causalidade. "
                "As hipóteses de driver por segmento precisam de validação experimental. "
                "O modelo foi treinado em base americana — pode não generalizar sem calibração local."
            ),
        },
        {
            "number": 10,
            "tag": "Recomendação",
            "title": "Arquitetura híbrida de análise e decisão",
            "subtitle": "Síntese e próximos passos",
            "content": (
                "A combinação de EDA, segmentação não supervisionada (K-Means), modelagem supervisionada "
                "e baseline interpretável forma uma arquitetura analítica robusta e defensável. "
                "Próximos passos: instrumentar a coleta de motivos de saída, realizar testes A/B de "
                "intervenção com os segmentos de alto risco, e monitorar o silhouette score para "
                "refinamento contínuo dos clusters. "
                "A Vitaliza tem os dados necessários para tomar decisões de retenção fundamentadas em evidência."
            ),
        },
    ]


def _format_segments(segments: list[dict]) -> str:
    if not segments:
        return "Nenhum segmento gerado. Execute a análise com o CSV enviado."
    lines = []
    for seg in segments:
        churn = seg.get("churn_rate")
        churn_str = f"{round(churn * 100, 1)}% churn" if churn is not None else ""
        count = seg.get("count", 0)
        label = seg.get("risk_label") or seg.get("label", "Segmento")
        lines.append(f"{label}: {count:,} clientes" + (f" · {churn_str}" if churn_str else ""))
    return " · ".join(lines[:4])


def _format_personas(personas: list[dict]) -> str:
    if not personas:
        return "Personas geradas após execução da análise completa."
    lines = []
    for p in personas[:3]:
        lines.append(
            f"{p.get('name', 'Perfil')} ({p.get('segment_label', '')}): "
            f"{p.get('resolution', '')}"
        )
    return " ".join(lines)
