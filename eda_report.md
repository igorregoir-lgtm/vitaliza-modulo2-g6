# EDA Report — Vitaliza (Sistema de Inteligência de Retenção)

> Análise exploratória de `data/gym_churn_us.csv` (4.000 assinantes × 14 colunas,
> churn global **26,52%**). Todos os números abaixo foram **computados sobre a base**
> (não estimados). Notebook reprodutível: `notebooks/eda_vitaliza.py` (Marimo) →
> `notebooks/01_eda_vitaliza.ipynb`. *Guardrail: correlação ≠ causalidade — a EDA
> prioriza hipóteses; a operação valida.*

## Panorama
- **Churn global:** 26,52% (1.061 de 4.000). Classe desbalanceada → métricas
  primárias ROC-AUC e PR-AUC (acurácia engana).
- **Sem nulos, sem duplicatas.** Limpeza pesada (winsorização p99) fica no
  pré-processador, *fit só no treino* (anti-leakage).

## 10 insights acionáveis

1. **Contrato é a alavanca-mãe da retenção.** Churn por `Contract_period`:
   **mensal (1m) = 42,3%**, semestral (6m) = 12,5%, **anual (12m) = 2,4%**. O mensal
   churna ~17× o anual. → **Ação:** campanha de migração para plano anual é a
   intervenção de maior ROI; priorizar mensais de alto score.

2. **O churn é precoce — a janela de onboarding decide.** `flag_early_user`
   (Lifetime ≤ 1): churn **61,4%** (1.330 usuários) vs **9,1%** para o resto. A curva
   Kaplan-Meier despenca no início. → **Ação:** programa de onboarding reforçado nas
   primeiras 2–4 semanas (metas iniciais, check-in humano).

3. **Queda de frequência é o sinal #1 de pré-churn.** `delta_freq` médio:
   **−0,430** para quem cancela vs **+0,003** para quem fica. Quem sai já vinha
   desacelerando. → **Ação:** disparar alerta de CS quando `delta_freq` fica negativo
   por 2+ semanas (nudge antes da decisão de cancelar).

4. **Sleeping dogs são estáveis — NÃO acordar.** Os 54 `sleeping_dogs`
   (Lifetime > 6, freq atual < 0,5) têm churn de apenas **1,85%** — bem abaixo da
   média. Mexer neles tende a piorar. → **Ação:** excluí-los de campanha proativa
   (guardrail ADR-0008, enforçado no advisor e na Tela 4).

5. **Comunidade corta o churn quase pela metade.** `Group_visits=1` (desafios em
   grupo): churn **17,3%** vs **33,0%** sem participação. → **Ação:** inscrever em
   desafios/aulas em grupo como intervenção de baixo custo para risco médio.

6. **Indicação retém.** `Promo_friends=1`: churn **15,8%** vs **31,3%**. Quem entrou
   por indicação tem laço social. → **Ação:** estimular o programa de indicação como
   onboarding social (ativa o efeito de comunidade do insight 5).

7. **Convênio/parceria reduz risco.** `Partner=1`: churn **19,4%** vs **33,3%**. →
   **Ação:** para preço-sensíveis, oferecer/destacar benefício de parceria antes de
   recorrer a desconto direto.

8. **Frequência atual é termômetro direto.** Média de `freq_current`: **1,05** (churn)
   vs **2,03** (fica) — metade. → **Ação:** usar `freq_current` como gatilho operacional
   simples de priorização da carteira (lista ranqueada da Tela 4).

9. **Adicionais e idade marcam vínculo.** Quem fica gasta mais em adicionais
   (**R$158** vs **R$115**) e é levemente mais velho (**30,0** vs **27,0** anos). Vínculo
   financeiro e maturidade correlacionam com permanência. → **Ação:** cross-sell de
   adicionais relevantes a clientes de risco médio (aumenta "stickiness").

10. **`Month_to_end_contract` é quase-leakage — fora do modelo.** Correlaciona
    **0,973** com `Contract_period` (relógio do contrato). Incluí-la não muda a AUC
    (delta +0,000 no teste A/B) mas infla artificialmente em cenários reais. → **Ação:**
    removida do conjunto de features (decisão auditada em `pipeline/leakage_audit.py` e
    no `docs/model_card.md`).

## Segmentação (resumo)
| Segmento | Regra | n | Churn |
|---|---|---|---|
| Early droppers | Lifetime ≤ 1 | 1.330 | 61,4% |
| Sleeping dogs | Lifetime > 6 e freq atual < 0,5 | 54 | 1,9% |
| Anuais uso-zero | Contrato 12m e freq atual < 0,1 | 32 | 12,5% |

## Como isso alimenta o modelo
As features derivadas (`delta_freq`, `ratio_freq_atual_vs_lifetime`, `flag_early_user`,
`flag_sleeping_dog`, `contract_x_lifetime`) saíram destes achados e são exatamente os
**top drivers SHAP** do modelo final (ver `pipeline/artifacts/shap_global.json`) —
fechando o ciclo EDA → feature engineering → explicabilidade.
