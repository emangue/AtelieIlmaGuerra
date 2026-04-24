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

---

## 🖥️ Infraestrutura VM (Hostinger)

### Domínio e SSH
- **Domínio correto:** `gestao.atelieilmaguerra.com.br` (com `.br` — `gestao.atelieilmaguerra.com` não existe)
- **IP:** `148.230.78.91`
- **SSH alias:** `minha-vps-hostinger` (configurado em `~/.ssh/config`)
- **Código na VM:** `/var/www/atelie/`

### Serviços systemd (ateliê)
| Serviço | Porta | Processo |
|---------|-------|----------|
| `atelie-backend` | **8001** | uvicorn (2 workers) |
| `atelie-frontend` | **3004** | next-server |

> ⚠️ O backend roda na porta **8001**, não 8000. Para testar diretamente:
> `curl http://localhost:8001/api/v1/...`

### Nginx (container Docker `infra_nginx`)
- O nginx **não é systemd** — roda como container Docker (`infra_nginx`)
- Portas 80/443 pertencem ao Docker. O `nginx.service` do systemd está inativo (normal)
- Config do ateliê: `/etc/nginx/conf.d/gestao.atelieilmaguerra.com.br.conf` (dentro do container)
- Para recarregar: `docker exec infra_nginx nginx -s reload`
- Roteamento: `/api/` e `/uploads/` → `172.20.0.1:8001` | `/` → `172.20.0.1:3004`

### Outros serviços Docker na mesma VM (não mexer)
- `finup_backend_prod` → porta 8000
- `finup_frontend_admin_prod` → porta 3001
- `finup_frontend_app_prod` → porta 3003
- `infra_nginx` → portas 80 e 443

### Banco de dados
- **Arquivo:** `/var/www/atelie/app_dev/backend/database/atelie.db`
- **Backup automático antes do deploy:** `/var/www/atelie/app_dev/backend/database/atelie_backup_YYYYMMDD_HHMMSS.db`
- Campo de senha do User: `password_hash` (não `hashed_password`)
- Função de hash em `password_utils.py`: `hash_password()` (não `get_password_hash()`)

### Como resetar senha de usuário na VM
```bash
ssh minha-vps-hostinger 'cd /var/www/atelie/app_dev/backend && \
  /var/www/atelie/app_dev/backend/venv/bin/python3 -c "
from app.core.database import SessionLocal
from app.domains.users.models import User
from app.domains.auth.password_utils import hash_password
db = SessionLocal()
u = db.query(User).filter(User.email == \"admin@atelie.com\").first()
u.password_hash = hash_password(\"admin123\")
db.commit(); db.close(); print(\"OK\")
"'
```

### Build do frontend na VM
- O build do Next.js demora ~2 min e expira o SSH timeout
- **Solução:** rodar em background com `nohup`:
  ```bash
  ssh minha-vps-hostinger 'nohup npm run build > /tmp/frontend_build.log 2>&1 & echo PID:$!'
  # Aguardar ~90s e checar:
  ssh minha-vps-hostinger 'tail -20 /tmp/frontend_build.log'
  ```

### Checklist de validação pós-deploy
```bash
# 1. Serviços
ssh minha-vps-hostinger 'systemctl is-active atelie-backend atelie-frontend'
# 2. Login direto no uvicorn (porta 8001)
ssh minha-vps-hostinger 'curl -s http://localhost:8001/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@atelie.com\",\"password\":\"admin123\"}" | python3 -m json.tool'
# 3. Login via HTTPS externo
curl -sk https://gestao.atelieilmaguerra.com.br/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@atelie.com","password":"admin123"}'
```
