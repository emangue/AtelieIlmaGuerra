# 🚀 Deploy - Gestão Ateliê Ilma Guerra

**Subdomínio:** gestao.atelieilmaguerra.com.br  
**Stack:** FastAPI (Backend) + Next.js (Frontend) + SQLite/PostgreSQL  
**Referência:** ProjetoFinancasV5 (meufinup.com.br)

---

## 📂 ORGANIZAÇÃO NO SERVIDOR

O projeto fica **isolado** em uma pasta dedicada:

```
/var/www/atelie/                    # Raiz do app (pasta isolada)
├── app_dev/
│   ├── backend/                    # FastAPI
│   │   ├── app/
│   │   ├── database/               # Criada no servidor (vazia no deploy)
│   │   ├── .env                    # Criado manualmente (NUNCA no rsync)
│   │   ├── .env.example            # Referência
│   │   └── requirements.txt
│   └── frontend/                   # Next.js
│       ├── .next/                  # Gerado no servidor (npm run build)
│       ├── .env.production         # Criado manualmente
│       └── package.json
├── docs/
└── scripts/
```

**Nenhum arquivo sensível é transferido** – ver `.deployignore` e seção 8.

---

## ✅ STATUS DO DEPLOY (Auditoria 15/02/2026)

| Item | Status | Detalhes |
|------|--------|----------|
| **URL** | ✅ Online | https://gestao.atelieilmaguerra.com.br |
| **Login** | ✅ Funcionando | ilma@atelieilmaguerra.com |
| **SSL/HTTPS** | ✅ Ativo | Let's Encrypt, válido até 16/05/2026 |
| **HTTP→HTTPS** | ✅ Redirect 301 | Automático |
| **Firewall UFW** | ✅ Ativo | Apenas 22, 80, 443 |
| **Backend (8001)** | ✅ localhost | Escuta 127.0.0.1 apenas |
| **Frontend (3004)** | ✅ Protegido | Atrás do Nginx, UFW bloqueia acesso direto |
| **PostgreSQL** | ✅ localhost | 127.0.0.1:5432 (atelie_db + finup_db) |
| **Arquivo .env** | ✅ 600 | Permissões restritas |
| **DEBUG** | ✅ false | Produção |
| **JWT_SECRET** | ✅ Configurado | Único, 64+ chars |
| **CORS** | ✅ Restrito | gestao.atelieilmaguerra.com.br |
| **Cookie auth_token** | ✅ Seguro | Secure, HttpOnly, SameSite=strict |
| **Middleware** | ✅ Ativo | Protege /mobile/* |
| **Fail2ban** | ✅ Ativo | Anti força-bruta |
| **Arquivos sensíveis** | ✅ Nenhum | Sem .xlsx, .pdf, .db na raiz |

**Último deploy:** 15/02/2026 – rsync + rebuild frontend + restart serviços. Login validado via API. **Dados migrados:** PostgreSQL (atelie_db) – 2.113 registros (clientes, pedidos, etc.).

---

## 📋 ÍNDICE

1. [Pré-requisitos](#1-pré-requisitos)
2. [Configuração DNS (Hostinger)](#2-configuração-dns-hostinger)
3. [Servidor VPS](#3-servidor-vps)
4. [Deploy da Aplicação](#4-deploy-da-aplicação)
5. [Nginx e SSL](#5-nginx-e-ssl)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)
7. [Checklist de Segurança](#7-checklist-de-segurança)
8. [Arquivos NUNCA Transferidos](#8-arquivos-nunca-transferidos)
9. [Migração de Dados](#9-migração-de-dados-sqlite--postgresql)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. PRÉ-REQUISITOS

- **Domínio:** atelieilmaguerra.com.br (já configurado na Hostinger)
- **Subdomínio:** gestao.atelieilmaguerra.com.br
- **VPS Hostinger** (ou similar com Ubuntu 22.04+)
- **Acesso SSH** ao servidor

---

## 2. CONFIGURAÇÃO DNS (HOSTINGER)

No painel da Hostinger (hPanel):

1. Acesse **Domínios** → **atelieilmaguerra.com.br** → **DNS / Nameservers**
2. Adicione registro **A** para o subdomínio:
   - **Tipo:** A
   - **Nome:** gestao (ou gestao.atelieilmaguerra.com.br, conforme o painel)
   - **Aponta para:** IP do seu VPS (ex: 148.230.78.91)
   - **TTL:** 14400

3. Aguarde propagação (5–30 min)

**Teste:**
```bash
ping gestao.atelieilmaguerra.com.br
# Deve retornar o IP do VPS
```

---

## 3. SERVIDOR VPS

### 3.1. Conectar e preparar

```bash
ssh root@SEU_IP_VPS
```

```bash
apt update && apt upgrade -y
apt install -y curl git ufw nginx certbot python3-certbot-nginx
```

### 3.2. Usuário deploy

```bash
adduser deploy
usermod -aG sudo deploy
```

### 3.3. Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw enable
```

---

## 4. DEPLOY DA APLICAÇÃO

### 4.1. Estrutura no servidor

```bash
sudo mkdir -p /var/www/atelie
sudo chown deploy:deploy /var/www/atelie
cd /var/www/atelie
```

### 4.2. Transferir código

**Opção A – Script de deploy (recomendado):**
```bash
# No seu Mac – usa .deployignore (exclui .env, *.db, uploads, planilhas, etc.)
./scripts/deploy.sh SEU_IP_VPS
```

**Opção B – rsync manual:**
```bash
# No seu Mac – exclusions do .deployignore
rsync -avz --exclude-from=.deployignore \
  /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/ \
  deploy@SEU_IP:/var/www/atelie/
```

**Opção C – Git (se repositório público, sem dados sensíveis):**
```bash
git clone https://github.com/SEU_USUARIO/AtelieIlmaGuerra.git .
# Depois: criar .env manualmente no servidor
```

### 4.3. Backend (FastAPI)

```bash
cd /var/www/atelie/app_dev/backend

# Criar pasta database (vazia – banco é criado na 1ª execução)
mkdir -p database

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Criar `.env` manualmente (ver seção 6) – **nunca** vem do deploy.

### 4.4. Frontend (Next.js)

```bash
cd /var/www/atelie/app_dev/frontend

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

npm ci
npm run build
```

Criar `.env.production` manualmente (ver seção 6) – **nunca** vem do deploy.

### 4.5. Serviços systemd

**Backend** – `/etc/systemd/system/atelie-backend.service`:

```ini
[Unit]
Description=Ateliê Ilma Guerra - FastAPI Backend
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/var/www/atelie/app_dev/backend
Environment="PATH=/var/www/atelie/app_dev/backend/venv/bin"
ExecStart=/var/www/atelie/app_dev/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2

PrivateTmp=true
NoNewPrivileges=true
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Frontend** – `/etc/systemd/system/atelie-frontend.service`:

```ini
[Unit]
Description=Ateliê Ilma Guerra - Next.js Frontend
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/var/www/atelie/app_dev/frontend
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/npm start

PrivateTmp=true
NoNewPrivileges=true
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Ativar:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable atelie-backend atelie-frontend
sudo systemctl start atelie-backend atelie-frontend
sudo systemctl status atelie-backend atelie-frontend
```

---

## 5. NGINX E SSL

### 5.1. Site Nginx

Criar `/etc/nginx/sites-available/atelie-gestao`:

```nginx
# HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gestao.atelieilmaguerra.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gestao.atelieilmaguerra.com.br;

    ssl_certificate /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API (mantém path: /api/v1/... → backend:8001/api/v1/...)
    # Nota: usar 8001 se a porta 8000 estiver ocupada (ex: FinUp)
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fotos de pedidos (uploads) - proxy para o backend
    location /uploads/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/atelie_gestao_access.log;
    error_log /var/log/nginx/atelie_gestao_error.log warn;
}
```

**Nota:** O backend FastAPI está em `/api/v1/...`. O Nginx faz proxy de `/api/` para `http://127.0.0.1:8001/`. O frontend usa URLs relativas (`/api/v1/...`) quando `NEXT_PUBLIC_BACKEND_URL` está vazio.

### 5.2. Habilitar site e SSL

```bash
sudo ln -s /etc/nginx/sites-available/atelie-gestao /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

**Certificado SSL (Let's Encrypt):**
```bash
sudo certbot --nginx -d gestao.atelieilmaguerra.com.br \
  --email seu-email@example.com --agree-tos --no-eff-email --redirect
```

Se o Certbot exigir o site em HTTP primeiro, use uma config temporária sem redirect e rode o certbot de novo.

### 5.3. Health check

```bash
curl https://gestao.atelieilmaguerra.com.br/api/health
# {"status":"healthy"}
```

---

## 6. VARIÁVEIS DE AMBIENTE

### 6.1. Backend – `app_dev/backend/.env`

**Produção usa PostgreSQL** (banco `atelie_db` no servidor):

```bash
# App
APP_NAME="Ateliê Ilma Guerra - API"
DEBUG=false

# Database - PostgreSQL em produção
DATABASE_URL=postgresql://atelie_user:SENHA@127.0.0.1:5432/atelie_db

# CORS
BACKEND_CORS_ORIGINS="https://gestao.atelieilmaguerra.com.br"

# Server
HOST=127.0.0.1
PORT=8000

# JWT (OBRIGATÓRIO - gerar com: openssl rand -hex 32)
JWT_SECRET_KEY=SUA_CHAVE_ALEATORIA_64_CARACTERES
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

```bash
chmod 600 .env
chown deploy:deploy .env
```

### 6.2. Frontend – `app_dev/frontend/.env.production`

**Recomendado** (URLs relativas, mesmo domínio):

```bash
NEXT_PUBLIC_BACKEND_URL=
NODE_ENV=production
```

Assim as chamadas serão relativas (`/api/v1/...`), o cookie `auth_token` funcionará no mesmo domínio e não haverá erro de CORS.

**Alternativa** (URL explícita):

```bash
NEXT_PUBLIC_BACKEND_URL=https://gestao.atelieilmaguerra.com.br
NODE_ENV=production
```

**Importante:** Após alterar `.env.production`, é obrigatório rodar `npm run build` novamente (variáveis `NEXT_PUBLIC_*` são embutidas no build).

---

## 7. CHECKLIST DE SEGURANÇA

- [x] `JWT_SECRET_KEY` único e aleatório (64+ caracteres)
- [x] `DEBUG=false` no backend
- [x] CORS restrito a `https://gestao.atelieilmaguerra.com.br`
- [x] SSL/HTTPS ativo (Certbot)
- [x] Backend escutando apenas em `127.0.0.1` (porta 8001)
- [x] Firewall UFW ativo (22, 80, 443)
- [x] `.env` com permissão 600
- [x] Cookie `auth_token` com `Secure` e `HttpOnly` em produção
- [x] Middleware protegendo rotas `/mobile/*`
- [x] Tratamento de 401 redirecionando para `/auth/login`

---

## 8. ARQUIVOS NUNCA TRANSFERIDOS

O `.deployignore` e o script `scripts/deploy.sh` garantem que **nada sensível** seja enviado:

| Tipo | Exemplos | Motivo |
|------|----------|--------|
| Variáveis de ambiente | `.env`, `.env.production` | Senhas, JWT secret, URLs |
| Banco de dados | `*.db`, `database/` | Dados de clientes, usuários |
| Uploads | `uploads/` | Arquivos enviados por usuários |
| Planilhas/contratos | `*.xlsx`, `*.pdf`, `*.docx` | Dados de clientes |
| Chaves/certificados | `*.pem`, `*.key` | SSL, credenciais |
| Logs | `*.log`, `temp/` | Podem conter dados sensíveis |
| Dependências | `node_modules/`, `venv/` | Instaladas no servidor |

**No servidor:** criar `.env` e `.env.production` manualmente a partir dos `.example`.

---

## 9. MIGRAÇÃO DE DADOS (SQLite → PostgreSQL)

Para subir os dados locais para o servidor:

1. **Criar banco e usuário** (uma vez, no servidor):
```bash
sudo -u postgres psql -c "CREATE DATABASE atelie_db;"
sudo -u postgres psql -c "CREATE USER atelie_user WITH ENCRYPTED PASSWORD 'SENHA_FORTE';"
sudo -u postgres psql -d atelie_db -c "GRANT ALL PRIVILEGES ON SCHEMA public TO atelie_user; ..."
```

2. **Criar tabelas** (no servidor):
```bash
cd /var/www/atelie/app_dev/backend && source venv/bin/activate
DATABASE_URL="postgresql://atelie_user:SENHA@127.0.0.1:5432/atelie_db" python -c "
from sqlalchemy import create_engine
from app.core.database import Base
engine = create_engine('postgresql://atelie_user:SENHA@127.0.0.1:5432/atelie_db')
from app.domains.clientes.models import Cliente
from app.domains.pedidos.models import Pedido, TipoPedido
from app.domains.orcamentos.models import Orcamento
from app.domains.parametros.models import ParametrosOrcamento
from app.domains.contracts.models import Contract
from app.domains.despesas.models import DespesaDetalhada
from app.domains.users.models import User
Base.metadata.create_all(bind=engine)
print('Tabelas criadas')
"
```

3. **Copiar SQLite e migrar** (no servidor):
```bash
# Na máquina local: scp app_dev/backend/database/atelie.db root@IP:/tmp/
# No servidor:
cd /var/www/atelie && source app_dev/backend/venv/bin/activate
ATELIE_POSTGRES_DSN="postgresql://atelie_user:SENHA@127.0.0.1:5432/atelie_db" \
  python3 scripts/migration/migrate_sqlite_to_postgres.py --sqlite-path /tmp/atelie.db --yes
```

4. **Atualizar .env** do backend com `DATABASE_URL=postgresql://...` e reiniciar.

---

## 10. TROUBLESHOOTING

### "Failed to fetch" ou erro CORS no login

**Causa:** O frontend está chamando `http://localhost:8000` em vez do domínio de produção.

**Solução:**
1. No servidor, edite `app_dev/frontend/.env.production` e defina `NEXT_PUBLIC_BACKEND_URL=` (vazio).
2. Reconstrua o frontend: `cd app_dev/frontend && npm run build`
3. Reinicie o serviço: `systemctl restart atelie-frontend`

### Nginx retorna 502 Bad Gateway em /api/

Verifique se o backend está rodando na porta correta (8001) e se o `proxy_pass` no Nginx aponta para ela.

### Backend não conecta ao PostgreSQL

Confirme que `DATABASE_URL` está no `.env` e que `psycopg2-binary` está instalado (`pip install psycopg2-binary`).

---

## 📚 REFERÊNCIAS

- **V5 (FinUp):** `ProjetoFinancasV5/docs/deploy/GUIA_DEPLOY_PRODUCAO.md`
- **Auth:** `ProjetoFinancasV5/docs/features/PLANO_AUTENTICACAO.md`

---

**Última atualização:** 15/02/2026  
**Último deploy:** 15/02/2026 – validações concluídas (login, SSL, firewall, serviços)
