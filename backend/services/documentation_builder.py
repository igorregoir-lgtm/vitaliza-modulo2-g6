_ALGO_DOCS = {
    "random_forest": {
        "title": "RandomForest + ROC-AUC",
        "text": (
            "A opção pelo <strong>RandomForestClassifier</strong> representa uma escolha por um algoritmo "
            "consolidado de machine learning disponível na biblioteca scikit-learn. Ele combina múltiplas "
            "árvores de decisão para estimar a probabilidade de churn de cada cliente, reduzindo a variância "
            "e aumentando a robustez das previsões. Sua performance deve ser avaliada principalmente pelo "
            "ROC-AUC, métrica adequada para medir a capacidade do modelo de diferenciar clientes com maior "
            "e menor risco de churn."
        ),
    },
    "kmeans": {
        "title": "K-Means + Silhouette Score",
        "text": (
            "A opção pelo <strong>KMeans</strong> representa uma escolha por um algoritmo consolidado de "
            "aprendizado não supervisionado, apropriado para segmentar clientes a partir de padrões observados "
            "de comportamento. Implementado por meio da biblioteca scikit-learn, o modelo organiza os clientes "
            "em grupos de similaridade, permitindo identificar segmentos com sinais mais fortes de risco, ainda "
            "que sem utilizar diretamente o rótulo histórico de churn no treinamento. Sua qualidade analítica "
            "deve ser interpretada principalmente pela coerência dos agrupamentos, pela separação entre clusters "
            "e pela capacidade de evidenciar segmentos comportamentais compatíveis com maior ou menor risco de evasão."
        ),
    },
    "logistic_regression": {
        "title": "Regressão Logística + ROC-AUC",
        "text": (
            "A opção pela <strong>LogisticRegression</strong> representa uma escolha por um algoritmo clássico, "
            "consolidado e altamente interpretável para problemas de classificação supervisionada. Implementado "
            "por meio da biblioteca scikit-learn, o modelo estima diretamente a probabilidade de churn a partir "
            "da contribuição estatística de cada variável explicativa, permitindo não apenas prever, mas também "
            "explicar a direção e intensidade da influência de cada atributo. Sua performance deve ser avaliada "
            "principalmente pelo ROC-AUC, sem prejuízo da análise complementar dos coeficientes do modelo, que "
            "favorecem a interpretabilidade e a defensabilidade da solução."
        ),
    },
    "xgboost": {
        "title": "XGBoost + ROC-AUC",
        "text": (
            "A opção pelo <strong>XGBClassifier</strong> representa uma escolha por um algoritmo consolidado "
            "de gradient boosting, amplamente reconhecido por sua alta performance em bases estruturadas de "
            "classificação. Implementado por meio da biblioteca XGBoost, o modelo constrói árvores de decisão "
            "de forma sequencial, corrigindo iterativamente os erros das etapas anteriores para refinar a "
            "predição de churn. Sua performance deve ser avaliada principalmente pelo ROC-AUC, métrica adequada "
            "para medir a capacidade do modelo de distinguir clientes com maior e menor probabilidade de churn."
        ),
    },
    "lightgbm": {
        "title": "LightGBM + ROC-AUC",
        "text": (
            "A opção pelo <strong>LGBMClassifier</strong> representa uma escolha por um algoritmo consolidado "
            "de gradient boosting otimizado para eficiência computacional e alto desempenho em bases tabulares. "
            "Implementado por meio da biblioteca LightGBM, o modelo utiliza árvores de decisão construídas de "
            "forma incremental, com foco em velocidade de treinamento e capacidade preditiva, sendo especialmente "
            "adequado para análises escaláveis de churn. Sua performance deve ser avaliada principalmente pelo "
            "ROC-AUC, métrica apropriada para aferir a capacidade do modelo de diferenciar clientes com maior "
            "e menor risco de churn."
        ),
    },
    "business_rules_baseline": {
        "title": "Baseline por Regra de Negócio",
        "text": (
            "A opção pela <strong>Baseline por Regra de Negócio</strong> representa uma escolha deliberada por "
            "uma camada de validação interpretável, construída a partir de regras simples e diretamente "
            "compreensíveis por stakeholders de negócio. Em vez de depender exclusivamente de aprendizado "
            "estatístico, essa abordagem organiza os clientes com base em variáveis-chave como tipo de contrato, "
            "tempo de plataforma e sinais básicos de engajamento, funcionando como um modelo de controle para "
            "testar a razoabilidade dos achados produzidos pelos algoritmos. Sua utilidade não está em maximizar "
            "performance preditiva, mas em oferecer clareza executiva, capacidade de auditoria e uma ponte "
            "metodológica entre o raciocínio analítico e a tomada de decisão."
        ),
    },
}

CONVERGENCE_TEXT = (
    "A utilização combinada de abordagens supervisionadas, não supervisionadas e de regra de negócio "
    "fortalece a confiabilidade da análise de retenção. O <strong>K-Means</strong> identifica segmentos "
    "de risco com base no comportamento observado dos clientes; o <strong>Random Forest</strong> estima "
    "a probabilidade individual de churn a partir do histórico rotulado da base; e a "
    "<strong>Baseline por Regra de Negócio</strong> funciona como uma camada de verificação interpretável, "
    "capaz de traduzir os achados em uma lógica executiva simples.\n\n"
    "Quando sobrepomos os clusters identificados pelo K-Means às predições do Random Forest e à segmentação "
    "sugerida pela baseline de negócio, a coincidência entre os grupos de maior risco funciona como um "
    "elemento adicional de validação analítica. Em termos práticos, isso significa que métodos diferentes, "
    "fundados em lógicas distintas, convergem para a identificação de perfis semelhantes de evasão.\n\n"
    "Essa convergência não implica equivalência entre os métodos. Ela indica, porém, que os sinais de risco "
    "são suficientemente consistentes para aparecer sob mais de uma lente analítica. Por isso, a adoção "
    "paralela dessas abordagens constitui uma alternativa metodologicamente defensável para suportar decisões "
    "de retenção, priorização comercial, desenho de experimentos e comunicação executiva."
)

LIMITATIONS = [
    "Ausência de motivo declarado de cancelamento — não sabemos por que o cliente saiu.",
    "Snapshot mensal sem série temporal granular — variações intra-mês não são capturadas.",
    "K-Means pressupõe clusters de formato esférico e tamanho similar — nem sempre verdade em dados reais.",
    "Silhouette score próximo de zero indica sobreposição entre grupos, reduzindo a separação analítica.",
    "Baseline por regra de negócio usa limiares fixos — pode classificar erroneamente perfis atípicos.",
    "Correlação identificada não implica causalidade — variáveis correlacionadas ao churn não o causam.",
    "Base americana (gym_churn_us.csv) — pode não generalizar para o contexto Vitaliza sem validação local.",
    "Hipóteses de driver por segmento precisam ser validadas em experimento controlado antes de virar política.",
    "Clientes 'sleeping dogs' representam risco latente não capturado pelo rótulo de churn observado.",
    "Tamanho da amostra (≈ 4.000 clientes) limita generalizações estatísticas para universos maiores.",
]


def build_documentation(algorithm: str, metrics: dict) -> dict:
    doc = _ALGO_DOCS.get(algorithm, _ALGO_DOCS["random_forest"])
    algo_name = {
        "random_forest": "Random Forest",
        "kmeans": "K-Means",
        "logistic_regression": "Regressão Logística",
        "xgboost": "XGBoost",
        "lightgbm": "LightGBM",
        "business_rules_baseline": "Baseline por Regra de Negócio",
    }.get(algorithm, algorithm)

    return {
        "algorithm_name": algo_name,
        "model_section": doc,
        "convergence": CONVERGENCE_TEXT,
        "limitations": LIMITATIONS,
    }
