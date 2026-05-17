# Gym Churn Predictor — Semana 5

## Estrutura

```
churn-project/
├── backend/
│   ├── main.py            ← API FastAPI (deploy no Render)
│   ├── train_model.py     ← script de treino (roda só local)
│   ├── requirements.txt
│   └── model.pkl          ← gerado pelo train_model.py (não sobe no git!)
├── frontend/
│   └── index.html         ← interface (deploy na Vercel)
└── dataset/
    └── gym_churn_us.csv   ← sua base (não sobe no git!)
```

---

## Passo a Passo

### 1. Organizar pastas localmente

```
mkdir dataset
mv gym_churn_us.csv dataset/
```

### 2. Treinar o modelo

```bash
cd backend
pip install -r requirements.txt
python train_model.py
# gera model.pkl na pasta backend/
```

### 3. Testar a API localmente

```bash
uvicorn main:app --reload
# Acesse http://localhost:8000/docs para ver e testar os endpoints
```

### 4. Subir código pro GitHub

```bash
git init
git add backend/ frontend/
git commit -m "feat: gym churn predictor semana 5"
git remote add origin https://github.com/SEU_USER/SEU_REPO.git
git push -u origin main
```

> ⚠️ Não suba `dataset/` nem `model.pkl` — crie um `.gitignore`

### 5. Deploy do backend no Render

1. Acesse https://render.com → New → Web Service
2. Conecte o repositório GitHub
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Após o deploy, vá em **Shell** e rode:
   ```bash
   # upload do model.pkl via Render Shell (ou use Render Disk)
   ```
   Alternativa mais fácil: incluir o `model.pkl` no repositório mesmo.
5. Copie a URL do serviço: `https://churn-api-xxxx.onrender.com`

### 6. Conectar frontend à API

Em `frontend/index.html`, linha 3 do script, troque:
```js
const API_URL = "https://SEU-PROJETO.onrender.com";
```
pela URL real do Render.

### 7. Deploy do frontend na Vercel

```bash
npm i -g vercel
cd frontend
vercel
# Segue as perguntas (Enter em tudo) → URL pronta em ~1 min
```

---

## .gitignore recomendado

```
model.pkl
dataset/
*.csv
__pycache__/
.env
.vercel
```

---

## Features utilizadas (11)

| Feature | Descrição |
|---|---|
| Lifetime | Meses como cliente |
| Avg_class_frequency_current_month | Frequência de aulas esse mês |
| Age | Idade do cliente |
| Contract_period | Duração do contrato (meses) |
| Month_to_end_contract | Meses até vencer o contrato |
| Avg_class_frequency_total | Frequência histórica de aulas |
| Avg_additional_charges_total | Gastos extras na academia |
| Group_visits | Participa de aulas em grupo (0/1) |
| Promo_friends | Veio por indicação (0/1) |
| Partner | Empresa parceira (0/1) |
| Near_Location | Mora perto da academia (0/1) |
