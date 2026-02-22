# 🤖 Instruções GitHub Copilot - Ateliê Ilma Guerra

## 📋 Estrutura do Projeto

```
AtelieIlmaGuerra/
├── app_dev/
│   ├── backend/          # FastAPI
│   │   ├── app/
│   │   │   ├── core/     # config, database
│   │   │   └── domains/ # auth, clientes, contracts, dashboard, despesas,
│   │   │                #   orcamentos, parametros, pedidos, plano, users
│   │   └── database/     # SQLite
│   └── frontend/         # Next.js (mobile-first)
│       └── src/
│           ├── app/      # rotas (mobile-first)
│           │   └── mobile/  # financeiro, pedidos, clientes, contratos, etc.
│           ├── components/
│           │   ├── ui/       # shadcn/ui
│           │   └── mobile/   # componentes mobile (charts, pickers, etc.)
│           └── contexts/     # AuthContext
├── docs/                 # documentação
├── scripts/              # utilitários
│   ├── quick_start.sh    # ▶ inicia backend + frontend
│   └── quick_stop.sh     # ■ para os servidores
└── .github/copilot-instructions.md
```

## 🎯 Regras Principais

### Backend (FastAPI)
- **Domínios:** Cada domínio em `app/domains/[nome]/` com models, schemas, service, router
- **Contratos:** Gerador de PDF em `domains/contracts/` - usa ReportLab
- **Auth:** JWT com cookie httpOnly

### Frontend (Next.js)
- **Mobile-first:** Layout otimizado para celular, rotas sob `/mobile/`
- **shadcn/ui:** Componentes em `components/ui/`
- **Recharts + SSR:** SEMPRE usar `dynamic(..., { ssr: false })` para componentes com Recharts.
  Criar o componente em `components/mobile/` e importar com dynamic na página.
  ❌ Nunca importar recharts diretamente em páginas do Next.js.

### Git
- Branch principal do projeto: `feature/plano-financeiro-graficos`

### Dados do Contrato
Ver `docs/MAPEAMENTO_CONTRATO.md` para campos mapeados do documento modelo.

## 🚀 Servidores — usar os scripts prontos

```bash
# ▶ Iniciar (backend + frontend automaticamente)
bash scripts/quick_start.sh

# ■ Parar
bash scripts/quick_stop.sh
```

Os scripts cuidam de venv, portas, PIDs e logs automaticamente.
- Logs em: `logs/backend.log` e `logs/frontend.log`
- **Backend:** http://localhost:8000
- **Frontend:** http://localhost:3001
- **API Docs:** http://localhost:8000/docs

> ⚠️ Não usar `python run.py` ou `npm run dev` manualmente — usar os scripts acima.

## 🔐 Credenciais padrão
- **Email:** admin@atelie.com / ilma@atelieilmaguerra.com
- **Senha:** admin123
