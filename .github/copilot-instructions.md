# 🤖 Instruções GitHub Copilot - Ateliê Ilma Guerra

## 📋 Estrutura do Projeto

```
AtelieIlmaGuerra/
├── app_dev/
│   ├── backend/          # FastAPI
│   │   ├── app/
│   │   │   ├── core/     # config, database
│   │   │   └── domains/ # auth, contracts
│   │   └── database/     # SQLite
│   └── frontend/         # Next.js (mobile-first)
│       └── src/
│           ├── app/      # rotas
│           ├── components/ui/  # shadcn
│           └── contexts/
├── docs/                 # documentação
└── .github/copilot-instructions.md
```

## 🎯 Regras Principais

### Backend (FastAPI)
- **Domínios:** Cada domínio em `app/domains/[nome]/` com models, schemas, service, router
- **Contratos:** Gerador de PDF em `domains/contracts/` - usa ReportLab
- **Auth:** JWT com cookie httpOnly, padrão similar ao ProjetoFinancasV5

### Frontend (Next.js)
- **Mobile-first:** Layout otimizado para celular
- **shadcn/ui:** Componentes em `components/ui/`
- **Rotas:** `/auth/login`, `/mobile/contratos`, `/mobile/contratos/novo`

### Dados do Contrato
Ver `docs/MAPEAMENTO_CONTRATO.md` para campos mapeados do documento modelo.

## 🚀 Comandos

```bash
# Backend
cd app_dev/backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python init_db.py
python run.py

# Frontend
cd app_dev/frontend && npm install && npm run dev
```

- **Backend:** http://localhost:8000
- **Frontend:** http://localhost:3001
- **API Docs:** http://localhost:8000/docs

## 🔐 Credenciais padrão
- **Email:** admin@atelie.com
- **Senha:** admin123
