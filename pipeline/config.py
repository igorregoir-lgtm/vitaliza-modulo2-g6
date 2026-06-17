"""
config.py — Configuração central do pipeline de churn (Vitaliza).

Fonte de verdade para: caminhos, semente de reprodutibilidade, listas de
features (originais + derivadas), quais features são ACIONÁVEIS pela operação,
limiares de tier de risco e razões de custo usadas no threshold por custo.

PBL — porquê: centralizar configuração evita "magic numbers" espalhados,
torna o pipeline auditável e reprodutível (uma única semente, um único lugar
para mudar thresholds). Tudo aqui é determinístico (SEED=42).
"""
from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# Caminhos (todos relativos à raiz do repo, resolvidos de forma absoluta)
# ---------------------------------------------------------------------------
PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(PIPELINE_DIR)
DATA_PATH = os.path.join(REPO_ROOT, "data", "gym_churn_us.csv")
ARTIFACTS_DIR = os.path.join(PIPELINE_DIR, "artifacts")

MODEL_PATH = os.path.join(ARTIFACTS_DIR, "model.joblib")
PREPROCESS_PATH = os.path.join(ARTIFACTS_DIR, "preprocess.joblib")
FEATURE_META_PATH = os.path.join(ARTIFACTS_DIR, "feature_meta.json")
SHAP_GLOBAL_JSON = os.path.join(ARTIFACTS_DIR, "shap_global.json")
SHAP_SUMMARY_PNG = os.path.join(ARTIFACTS_DIR, "shap_summary.png")
SHAP_BAR_PNG = os.path.join(ARTIFACTS_DIR, "shap_bar.png")
SHAP_WATERFALL_PNG = os.path.join(ARTIFACTS_DIR, "shap_waterfall_example.png")
METRICS_JSON = os.path.join(ARTIFACTS_DIR, "metrics.json")

# ---------------------------------------------------------------------------
# Reprodutibilidade
# ---------------------------------------------------------------------------
SEED = 42

# ---------------------------------------------------------------------------
# Alvo e split
# ---------------------------------------------------------------------------
TARGET = "Churn"
# 70/15/15 estratificado: 0.30 fora de treino; metade do que sobra vira teste.
TEST_SIZE = 0.15
VAL_SIZE = 0.15  # do total
KFOLDS = 5

# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------
# Colunas originais do CSV (sem o alvo).
RAW_FEATURES = [
    "gender",
    "Near_Location",
    "Partner",
    "Promo_friends",
    "Phone",
    "Contract_period",
    "Group_visits",
    "Age",
    "Avg_additional_charges_total",
    "Month_to_end_contract",
    "Lifetime",
    "Avg_class_frequency_total",
    "Avg_class_frequency_current_month",
]

# Binárias (0/1) — passam direto, sem escala.
BINARY_FEATURES = [
    "gender",
    "Near_Location",
    "Partner",
    "Promo_friends",
    "Phone",
    "Group_visits",
]

# Numéricas contínuas/ordinais — imputação + escala (+ winsorização nas de gasto/freq).
NUMERIC_FEATURES = [
    "Contract_period",
    "Age",
    "Avg_additional_charges_total",
    "Lifetime",
    "Avg_class_frequency_total",
    "Avg_class_frequency_current_month",
]

# Features que recebem winsorização no p99 (cauda longa de gasto/frequência).
WINSORIZE_FEATURES = [
    "Avg_additional_charges_total",
    "Avg_class_frequency_total",
    "Avg_class_frequency_current_month",
]
WINSORIZE_PERCENTILE = 99

# Features derivadas (criadas em features.py). Numéricas.
DERIVED_NUMERIC = [
    "ratio_freq_atual_vs_lifetime",
    "delta_freq",
    "contract_x_lifetime",
]
DERIVED_BINARY = [
    "flag_early_user",
    "flag_sleeping_dog",
]

# ---------------------------------------------------------------------------
# Leakage: feature suspeita removida do conjunto final (ver leakage_audit.py).
# Month_to_end_contract é o complemento quase-determinístico de Contract_period
# e Lifetime e funciona como proxy de "tempo restante" — variável de futuro.
# A auditoria (leakage_audit.py) mede o delta de AUC com/sem ela e justifica.
# ---------------------------------------------------------------------------
LEAKY_FEATURES = ["Month_to_end_contract"]

# Conjunto de features que o MODELO realmente usa (leakage-safe):
# originais (menos as vazadas) + derivadas.
def model_feature_list() -> list[str]:
    base = [f for f in RAW_FEATURES if f not in LEAKY_FEATURES]
    return base + DERIVED_NUMERIC + DERIVED_BINARY


# Quais features são ACIONÁVEIS pela operação (CS pode influenciar) vs não.
# Gênero/idade/proximidade não são acionáveis; frequência, desafios em grupo,
# adicionais, indicação, contrato e os derivados de engajamento são acionáveis.
ACTIONABLE_FEATURES = {
    "gender": False,
    "Near_Location": False,
    "Partner": True,           # convênio/parceria pode ser oferecido
    "Promo_friends": True,     # indicação pode ser estimulada
    "Phone": False,
    "Contract_period": True,   # migração de contrato é a alavanca central
    "Group_visits": True,      # desafios em grupo / comunidade
    "Age": False,
    "Avg_additional_charges_total": True,
    "Lifetime": False,         # tempo de casa não é acionável
    "Avg_class_frequency_total": True,
    "Avg_class_frequency_current_month": True,
    # derivadas
    "ratio_freq_atual_vs_lifetime": True,
    "delta_freq": True,
    "contract_x_lifetime": True,
    "flag_early_user": False,  # é um estado, não uma alavanca direta
    "flag_sleeping_dog": False,
}

# ---------------------------------------------------------------------------
# Tiers de risco (sobre a probabilidade calibrada de churn)
# ---------------------------------------------------------------------------
RISK_TIERS = {
    "baixo": (0.00, 0.30),
    "medio": (0.30, 0.60),
    "alto": (0.60, 1.01),
}


def risk_tier(prob: float) -> str:
    """Mapeia uma probabilidade calibrada para um tier de risco."""
    for name, (lo, hi) in RISK_TIERS.items():
        if lo <= prob < hi:
            return name
    return "alto"


# ---------------------------------------------------------------------------
# Custos para o threshold por custo (unidades relativas, R$).
#   - FN (deixar de agir em quem ia churnar): perde LTV de um recuperável.
#   - FP (acionar quem não ia churnar): custo da intervenção + risco de
#     "acordar o cão que dorme". FP é menos caro que FN em geral, mas não-zero.
# A razão FN:FP define o ponto que minimiza o custo esperado.
# ---------------------------------------------------------------------------
COST_FN = 10.0   # perder um cliente recuperável
COST_FP = 2.0    # acionar/incomodar um cliente que ficaria
COST_TP = 1.0    # custo da intervenção bem direcionada (incluído quando age corretamente)
COST_TN = 0.0

# Restrição de recall mínima (classe churn) — regra de negócio dura.
MIN_RECALL = 0.70

MODEL_VERSION = "vitaliza-churn-1.0.0"
