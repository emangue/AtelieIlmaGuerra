# Ateliê Ilma Guerra - Gerador de Contratos

Sistema para geração de contratos de vestido de noiva sob medida. Backend FastAPI, frontend Next.js, login e foco mobile.

## Estrutura

```
AtelieIlmaGuerra/
├── app_dev/
│   ├── backend/     # FastAPI + SQLite
│   └── frontend/    # Next.js + shadcn/ui
├── docs/            # Mapeamento do contrato
└── .github/         # Copilot instructions
```

## Início Rápido

### Backend
```bash
cd app_dev/backend
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate no Windows
pip install -r requirements.txt
python init_db.py
python run.py
```

### Frontend
```bash
cd app_dev/frontend
npm install
npm run dev
```

### Acesso
- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:8000
- **Docs API:** http://localhost:8000/docs

### Login padrão
- **Email:** admin@atelie.com
- **Senha:** admin123

## Funcionalidades

1. **Login** – Autenticação JWT
2. **Lista de contratos** – `/mobile/contratos`
3. **Novo contrato** – Formulário com dados do cliente, especificações do vestido, valores e datas
4. **Gerar PDF** – Download do contrato preenchido

## Mapeamento do Contrato

O documento original está em `Contrato Aline Albuquerque.docx.pdf`. Os campos mapeados estão em `docs/MAPEAMENTO_CONTRATO.md`.
