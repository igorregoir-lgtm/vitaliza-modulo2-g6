"""
archetypes.py — Classificação em 5 arquétipos acionáveis (ADR-0008).

PBL — porquê: um score sozinho não diz O QUE fazer. O arquétipo traduz
score + drivers SHAP dominantes + regras de negócio em uma persona com política
de intervenção. Isso conecta o modelo à ação (a melhoria pedida pelo professor).

Os 5 arquétipos e suas políticas:
  - preco_sensivel: risco puxado por contrato curto / gasto adicional / sem
    indicação. Política: oferta de migração anual com desconto dentro do teto.
  - desengajado_conteudo: risco puxado por queda de frequência (delta_freq,
    ratio) mas ainda ativo. Política: reengajamento por conteúdo/aulas/desafios.
  - early_dropper: Lifetime<=1 e baixa frequência. Política: onboarding reforçado,
    acompanhamento próximo nas primeiras semanas.
  - sleeping_dog: Lifetime>6 e freq corrente<0,5 (cliente antigo hoje inativo).
    Política: NÃO intervir proativamente (guardrail "não acorde o cão que dorme").
    proactive_allowed=False — a Função B de recomendação deve RECUSAR oferta.
  - concorrente_driven: ativo, contrato ok, mas risco residual sem driver de
    engajamento — provável atração por concorrente. Política: reforço de valor /
    benefício de parceria (Partner), comunidade.

A regra de sleeping_dog tem prioridade máxima (segurança > tudo).
"""
from __future__ import annotations

from . import config
from .features import is_sleeping_dog

ARCHETYPES = [
    "preco_sensivel",
    "desengajado_conteudo",
    "early_dropper",
    "sleeping_dog",
    "concorrente_driven",
]

# Política por arquétipo (consumida pela UI e pelo advisor LLM).
ARCHETYPE_POLICY = {
    "preco_sensivel": {
        "proactive_allowed": True,
        "lever": "migracao_contrato_anual",
        "policy": "Oferta de plano anual com desconto dentro do teto; destacar economia vs mensal.",
    },
    "desengajado_conteudo": {
        "proactive_allowed": True,
        "lever": "reengajamento_conteudo",
        "policy": "Reengajar por aulas/desafios em grupo; nudge de frequência; trilha personalizada.",
    },
    "early_dropper": {
        "proactive_allowed": True,
        "lever": "onboarding_reforcado",
        "policy": "Onboarding próximo nas primeiras semanas; metas iniciais; check-in humano.",
    },
    "sleeping_dog": {
        "proactive_allowed": False,
        "lever": "nenhuma_acao_proativa",
        "policy": "NÃO intervir proativamente (guardrail ADR-0008). Apenas reagir se o cliente buscar.",
    },
    "concorrente_driven": {
        "proactive_allowed": True,
        "lever": "reforco_de_valor",
        "policy": "Reforço de valor/benefício de parceria (convênio) e comunidade; evitar guerra de preço.",
    },
}


def _dominant_features(shap_contribs, k=3):
    """Top-k features por |shap| dentre as contribuições fornecidas."""
    if not shap_contribs:
        return []
    ordered = sorted(shap_contribs, key=lambda c: abs(c.get("shap_value", 0)), reverse=True)
    return [c["feature"] for c in ordered[:k]]


def classify_archetype(features_dict: dict, score: float, shap_contribs: list | None = None) -> dict:
    """Classifica um usuário em um dos 5 arquétipos.

    Parameters
    ----------
    features_dict : dict  -- features originais do usuário
    score         : float -- probabilidade de churn calibrada
    shap_contribs : list  -- contribuições SHAP locais (de explain_local)

    Returns
    -------
    dict {archetype, proactive_allowed, lever, policy, rationale}
    """
    shap_contribs = shap_contribs or []
    dom = _dominant_features(shap_contribs, k=3)

    lifetime = features_dict.get("Lifetime", 0)
    freq_cur = features_dict.get("Avg_class_frequency_current_month", 0)
    freq_tot = features_dict.get("Avg_class_frequency_total", 0)
    contract = features_dict.get("Contract_period", 1)
    promo = features_dict.get("Promo_friends", 0)
    charges = features_dict.get("Avg_additional_charges_total", 0)

    # 1) Sleeping dog — prioridade máxima (guardrail de segurança).
    if is_sleeping_dog(features_dict):
        arch = "sleeping_dog"
        rationale = (f"Lifetime={lifetime} (>6) e freq_atual={freq_cur} (<0,5): "
                     f"cliente antigo hoje inativo — não acordar.")
        return _wrap(arch, rationale, dom, score)

    # 2) Early dropper — recém-chegado com baixa frequência.
    if lifetime <= 1 and freq_cur < 1.0:
        arch = "early_dropper"
        rationale = (f"Lifetime={lifetime} (<=1) e freq_atual={freq_cur} (<1): "
                     f"risco de desistência inicial.")
        return _wrap(arch, rationale, dom, score)

    # 3) Desengajado de conteúdo — queda de engajamento é o driver dominante.
    engagement_drivers = {"delta_freq", "ratio_freq_atual_vs_lifetime",
                          "Avg_class_frequency_current_month"}
    freq_dropping = (freq_tot > 0 and freq_cur < 0.7 * freq_tot)
    if (set(dom) & engagement_drivers) or freq_dropping:
        arch = "desengajado_conteudo"
        rationale = (f"Drivers de engajamento dominantes ({[d for d in dom if d in engagement_drivers] or 'queda de freq'}); "
                     f"freq caiu de {round(freq_tot,2)} para {round(freq_cur,2)}.")
        return _wrap(arch, rationale, dom, score)

    # 4) Preço-sensível — contrato curto / gasto adicional / sem indicação.
    if contract <= 1 or ("Contract_period" in dom) or ("Avg_additional_charges_total" in dom and charges > 0):
        arch = "preco_sensivel"
        rationale = (f"Contrato curto (Contract_period={contract}) e/ou gasto adicional "
                     f"relevante; indicação={promo}.")
        return _wrap(arch, rationale, dom, score)

    # 5) Default — risco residual sem driver de engajamento: concorrente-driven.
    arch = "concorrente_driven"
    rationale = ("Cliente ativo com contrato ok e risco residual sem driver de "
                 "engajamento — provável atração externa/concorrência.")
    return _wrap(arch, rationale, dom, score)


def _wrap(arch, rationale, dom, score):
    pol = ARCHETYPE_POLICY[arch]
    return {
        "archetype": arch,
        "proactive_allowed": pol["proactive_allowed"],
        "lever": pol["lever"],
        "policy": pol["policy"],
        "dominant_drivers": dom,
        "score": round(float(score), 4),
        "rationale": rationale,
    }


if __name__ == "__main__":
    sd = {"Lifetime": 9, "Avg_class_frequency_current_month": 0.1,
          "Avg_class_frequency_total": 1.5, "Contract_period": 12}
    print("sleeping_dog ->", classify_archetype(sd, 0.7)["archetype"],
          "| proactive:", classify_archetype(sd, 0.7)["proactive_allowed"])
    ed = {"Lifetime": 1, "Avg_class_frequency_current_month": 0.3,
          "Avg_class_frequency_total": 0.5, "Contract_period": 1}
    print("early_dropper ->", classify_archetype(ed, 0.8)["archetype"])
