# Model Card — Vitaliza Churn Model

> Documento de auditabilidade (exigência tipo-ANPD; SPEC §10). Descreve escopo,
> dados, decisões, métricas e limites do modelo de previsão de churn. Reprodutível
> com `random_state=42` em todo o pipeline.

- **Modelo:** `vitaliza-churn-1.0.0`
- **Algoritmo:** XGBoost (gradient boosting) tunado com Optuna (40 trials, k-fold
  estratificado k=5), com **CalibratedClassifierCV (sigmoid)** para calibração de
  probabilidade.
- **Treino:** offline (`trained_at = "TRAINED_OFFLINE"`).
- **Artefatos:** `pipeline/artifacts/model.joblib`, `preprocess.joblib`,
  `feature_meta.json`, `metrics.json`, `shap_*`.

## 1. Escopo e uso pretendido
Prever a **probabilidade de churn** de um assinante e explicar a previsão (SHAP
global + local), para apoiar Customer Success, Produto e Liderança em ações de
retenção priorizadas e auditáveis. **Não** é um juízo causal nem uma decisão
automática: é um sistema de **priorização com humano no loop**.

## 2. Dados
- **Fonte única:** `data/gym_churn_us.csv` — 4.000 registros × 14 colunas.
- **SHA-256:** `8b6c2c47f178901fdbc7116d65b593ac392c21514dde4ce7e83e788cbd7bc7b6`
- **Taxa de churn:** 26,52% (1.061 / 4.000) — classe desbalanceada.
- **Split:** estratificado **70/15/15** (treino/val/teste), seed 42.
- **Sem PII real** (dataset anonimizado/sintético).

### Features usadas (conjunto leakage-safe)
Originais (menos a excluída) + derivadas, na ordem de entrada do modelo:
`Contract_period, Age, Avg_additional_charges_total, Lifetime,
Avg_class_frequency_total, Avg_class_frequency_current_month,
ratio_freq_atual_vs_lifetime, delta_freq, contract_x_lifetime, gender,
Near_Location, Partner, Promo_friends, Phone, Group_visits, flag_early_user,
flag_sleeping_dog`.

**Acionáveis** (a operação pode influenciar): `Partner, Promo_friends,
Contract_period, Group_visits, Avg_additional_charges_total,
Avg_class_frequency_total, Avg_class_frequency_current_month,
ratio_freq_atual_vs_lifetime, delta_freq, contract_x_lifetime`.
**Não-acionáveis** (estado/demografia): `gender, Near_Location, Phone, Age,
Lifetime, flag_early_user, flag_sleeping_dog`.

### Features excluídas (com razão)
- **`Month_to_end_contract` — EXCLUÍDA (quase-leakage / variável de futuro).** Ver §3.

## 3. Auditoria de leakage (evidência, não opinião)
Executada em `pipeline/leakage_audit.py`. Conclusões por variável suspeita:

- **`Month_to_end_contract` → REMOVIDA.** Correlaciona **0,973** com
  `Contract_period` (é o "relógio" do contrato — quanto falta para acabar), o que a
  torna uma variável de futuro/proxy. **Teste A/B** (mesma LogReg, com vs sem a
  feature, teste 30%): AUC = **0,9739 em ambos** → **delta = +0,0000**. Ou seja, ela
  **não agrega poder preditivo legítimo** mas inflaria a métrica artificialmente em
  cenários reais. Custo de removê-la: zero. Decisão: **fora**.
- **`Lifetime` → MANTIDA.** É o tempo de casa **observável no momento da predição**
  (não é futuro), causal-plausível (early users churnam mais) e necessária para
  `flag_early_user` e `flag_sleeping_dog`. **Não** constitui leakage.

**Conjunto final:** features originais SEM `Month_to_end_contract` + derivadas.
Defensavelmente leakage-safe: nenhuma variável de futuro; pré-processamento
(`Winsorizer` p99 + imputação + escala) **fit somente no treino** e reaplicado
identicamente em val/teste/produção.

## 4. Método de validação
- Split estratificado 70/15/15 + **k-fold estratificado (k=5)** dentro da busca
  Optuna (objetivo: ROC-AUC médio dos folds).
- Calibração com `CalibratedClassifierCV` (cv=5); escolha entre isotônica/sigmoide
  pela PR-AUC na validação → **sigmoid**.
- **Threshold por custo** escolhido **na validação** (nunca no teste).

## 5. Métricas finais (conjunto de TESTE, held-out, n=600)
| Métrica | Treino | Validação | **Teste** |
|---|---|---|---|
| ROC-AUC | 0,9981 | 0,9896 | **0,9878** |
| PR-AUC | 0,9949 | 0,9792 | **0,9748** |
| Recall (churn) | 1,0000 | 0,9686 | **0,9497** |
| Precision | 0,8265 | 0,7979 | **0,8032** |
| F1 | 0,9050 | 0,8750 | **0,8703** |
| Lift (decil topo) | 3,77 | 3,77 | **3,77** |

- **Threshold por custo:** **0,05** (razão FN:FP:TP = 10:2:1; restrição recall ≥ 0,70).
  Recall@threshold (val) = 0,969. O custo de perder um recuperável (FN) domina, então
  o ponto ótimo prioriza recall — coerente com o negócio (reter > não incomodar).
- **Calibração:** sigmoid.
- **Metas atingidas:** Final ROC-AUC ≥ 0,82 ✔ (0,988) **E** recall ≥ 0,70 ✔ (0,950).

## 6. Overfit (evidência)
**Gap ROC-AUC treino − teste = +0,0103** (0,9981 → 0,9878). Gap pequeno e
val ≈ teste → **sem overfit relevante**. A regularização do XGBoost (gamma,
reg_lambda/alpha, subsample/colsample) e a validação k-fold contiveram a variância.

> Nota de honestidade: a AUC alta (~0,99) é característica **deste dataset** (o
> artefato de referência atinge ~0,965). Não inflamos via leakage — pelo contrário,
> removemos `Month_to_end_contract` mesmo sem custo de AUC. O sinal forte vem das
> features de engajamento (`delta_freq`, `ratio`), que são legítimas e acionáveis.

## 7. Explicabilidade (SHAP)
`shap.TreeExplainer` sobre o modelo tree **pré-calibração** (a calibração é
monotônica e não altera o ranqueamento de drivers). **Top-5 global (mean|SHAP|):**
`delta_freq` (1,61), `contract_x_lifetime` (1,31), `Lifetime` (0,91),
`ratio_freq_atual_vs_lifetime` (0,90), `Age` (0,82). Artefatos:
`shap_summary.png`, `shap_bar.png`, `shap_waterfall_example.png`, `shap_global.json`.

**Caveat obrigatório (Semana 9):** *SHAP explica o MODELO, não a causalidade do
mundo real.* Um driver com alto |SHAP| indica peso na decisão do modelo, não que
alterá-lo no cliente mude o desfecho. As recomendações priorizam features
**acionáveis** e passam por validação humana.

## 8. Princípios de decisão e guardrails
- **"Não acorde o cão que dorme" (ADR-0008):** `sleeping_dog` (Lifetime > 6 e
  freq atual < 0,5) tem `proactive_allowed=False` — a recomendação proativa é
  **recusada** por política. Justificativa empírica: esse grupo tem churn de apenas
  1,9% na base; intervir tende a piorar.
- **Threshold por custo, não 0,5 ingênuo:** o limiar reflete a assimetria de custo
  (perder recuperável » incomodar quem fica).
- **Calibração:** o score tem leitura de risco (probabilidade ≈ frequência real).

## 9. Limites
- Dataset estático de 4.000 linhas; sem deriva temporal modelada (sem retreino
  automático — retreino é manual/offline).
- 54 sleeping dogs e 32 anuais-uso-zero são amostras pequenas — políticas desses
  grupos baseiam-se em regra de negócio + amostra limitada.
- Generalização para a população real da Vitaliza depende de o dataset ser
  representativo (mapeamento sintético→case).
- O modelo prevê **probabilidade**, não certeza; decisões de retenção exigem
  humano no loop.

## 10. Reprodutibilidade
`SEED = 42` em todo o pipeline; dataset versionado por SHA-256; artefatos
serializados com joblib; pipelines de treino e inferência separados
(`pipeline/train_*.py` × `pipeline/inference.py`).
