# ADR-0004 — Notebook em Marimo (+ export para `.ipynb`)

- **Status:** Accepted · **Data:** 2026-06-17

## Contexto
O cliente pediu explicitamente **Marimo** no notebook. A própria Trilha (Semanas 1–2) adota Marimo
(reactive notebooks) e a skill `marimo-pair`. O enunciado, porém, nomeia o deliverable
`01_eda_vitaliza.ipynb` (Jupyter).

## Decisão
- **Notebook primário em Marimo:** `notebooks/eda_vitaliza.py` (reativo, reprodutível, versionável
  como Python puro — bom para auditoria/diff).
- **Export** para `notebooks/01_eda_vitaliza.ipynb` (deliverable nomeado) via `marimo export ipynb`.

## Opções consideradas
1. Só Jupyter (rejeitado: contraria a diretriz do cliente e da Trilha).
2. Só Marimo (rejeitado: o enunciado nomeia um `.ipynb`).
3. **Marimo + export `.ipynb` (escolhido)** — atende ambos.

## Consequências
- O `.py` do Marimo é a fonte de verdade auditável; o `.ipynb` é artefato derivado.
- A lógica de EDA é reaproveitada pelos pipelines de treino (sem duplicação).
