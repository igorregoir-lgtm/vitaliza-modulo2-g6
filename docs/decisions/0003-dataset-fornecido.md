# ADR-0003 — Dataset = CSV fornecido (gym_churn, 4000×14)

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O cliente anexou o dataset oficial deste artefato. O enunciado fala em "CSV de 4.000 usuários" com
"14 variáveis" e churn de "26,5%".

## Decisão
Usar **`data/gym_churn_us.csv`** (cópia do arquivo fornecido) como **fonte única**. Verificado:
**4.000 registros, 14 colunas, churn 26,5%** (2.939/1.061) — bate com o enunciado.

## Colunas
`gender, Near_Location, Partner, Promo_friends, Phone, Contract_period, Group_visits, Age,
Avg_additional_charges_total, Month_to_end_contract, Lifetime, Avg_class_frequency_total,
Avg_class_frequency_current_month, Churn`.

## Consequências
- Mapeamento explícito ao vocabulário Vitaliza (frequência, contrato, desafios, indicação, convênio).
- `gender`/`Phone` são candidatos a descarte por baixa correlação (a confirmar na EDA).
- Variáveis com risco de quase-leakage (`Month_to_end_contract`, `Lifetime`) serão auditadas (ADR-0006/§7).
