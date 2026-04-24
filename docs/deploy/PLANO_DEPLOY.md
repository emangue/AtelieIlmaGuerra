# Plano de Deploy — Ateliê Ilma Guerra

**Objetivo:** Deploy seguro e reproduzível para gestao.atelieilmaguerra.com.br

---

## Visão Geral

```
[Local]                    [VM]
  │                          │
  │ 1. deploy.sh              │
  │    (rsync + build)        │
  ├─────────────────────────► │ /var/www/atelie/
  │                          │
  │                          │ 2. pos_deploy_vm.sh
  │                          │    (venv, npm, restart)
  │                          │
  │                          │ 3. Nginx do sistema
  │                          │
  └─────────────────────────► https://gestao.atelieilmaguerra.com.br
```

---

## Fase 1 — Preparação Local

### 1.1. Configurar SSH (uma vez)

Adicione ao `~/.ssh/config`:

```
Host minha-vps-hostinger
  HostName 148.230.78.91
  Port 22
  User root
  IdentityFile ~/.ssh/id_rsa_hostinger
```

### 1.2. Variáveis de deploy

Edite `scripts/deploy/config.sh` se necessário:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| VM_HOST | minha-vps-hostinger | Alias SSH |
| ATELIE_PATH | /var/www/atelie | Pasta no servidor |

---

## Fase 2 — Deploy do Código

### 2.1. Executar deploy

```bash
# Opção A: Usar alias SSH (recomendado)
./scripts/deploy.sh

# Opção B: Usar IP diretamente
./scripts/deploy.sh 148.230.78.91
```

O script:
1. Faz build do frontend (`npm run build`)
2. Envia via rsync (respeitando `.deployignore`)
3. **Nunca** envia: `.env`, `*.db`, `uploads/`, planilhas, certificados

### 2.2. O que NÃO é enviado

- `.env`, `.env.production` — criar manualmente na VM
- `node_modules/`, `venv/`, `.next/` — instalar/gerar na VM
- `*.db`, `database/` — dados sensíveis
- `uploads/` — arquivos de usuário

---

## Fase 3 — Pós-Deploy na VM

### 3.1. Conectar e executar

```bash
ssh minha-vps-hostinger
cd /var/www/atelie
bash scripts/deploy/pos_deploy_vm.sh
```

O script `pos_deploy_vm.sh`:
1. Cria venv e instala dependências Python
2. Instala npm e faz build do frontend
3. Verifica/cria `.env` e `.env.production` (não sobrescreve se existirem)
4. Instala unit files systemd (se não existirem)
5. Reinicia serviços

### 3.2. Variáveis de ambiente (criar manualmente se não existirem)

**Backend** — `app_dev/backend/.env`:

```bash
DEBUG=false
DATABASE_URL=postgresql://atelie_user:SENHA@127.0.0.1:5432/atelie_db
BACKEND_CORS_ORIGINS="https://gestao.atelieilmaguerra.com.br"
HOST=127.0.0.1
PORT=8001
JWT_SECRET_KEY=$(openssl rand -hex 32)  # Gerar e colar
```

**Frontend** — `app_dev/frontend/.env.production`:

```bash
NEXT_PUBLIC_BACKEND_URL=
NODE_ENV=production
```

---

## Fase 4 — Nginx e HTTPS

O Ateliê usa Nginx do sistema (portas 80/443). Backend e frontend rodam via systemd e são acessados pelo Nginx via proxy.

```bash
# Na VM
sudo cp /var/www/atelie/scripts/nginx-atelie-gestao.conf /etc/nginx/sites-available/atelie-gestao
sudo ln -sf /etc/nginx/sites-available/atelie-gestao /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Ver `docs/deploy/GUIA_DEPLOY_GESTAO.md` para detalhes (Certbot, certificados, etc.).

---

## Fase 5 — Validação

### 5.1. Na VM

```bash
bash /var/www/atelie/scripts/validar_deploy_vm.sh
```

### 5.2. Externo

```bash
curl -sI https://gestao.atelieilmaguerra.com.br | head -5
curl -s https://gestao.atelieilmaguerra.com.br/api/health
```

---

## Checklist Rápido

| # | Ação | Onde |
|---|------|------|
| 1 | `./scripts/deploy.sh` | Local |
| 2 | `bash scripts/deploy/pos_deploy_vm.sh` | VM |
| 3 | Criar `.env` e `.env.production` (se 1ª vez) | VM |
| 4 | Configurar Nginx (sites-available/atelie-gestao) | VM |
| 5 | `bash scripts/validar_deploy_vm.sh` | VM |

---

## Arquivos do Plano

| Arquivo | Função |
|---------|--------|
| `scripts/deploy/config.sh` | VM_HOST, ATELIE_PATH |
| `scripts/deploy.sh` | Deploy principal (rsync + build) |
| `scripts/deploy/pos_deploy_vm.sh` | Pós-deploy na VM |
| `scripts/deploy/atelie-backend.service` | Unit systemd backend |
| `scripts/deploy/atelie-frontend.service` | Unit systemd frontend |
| `scripts/nginx-atelie-gestao.conf` | Config Nginx (proxy para 3004 e 8001) |
| `scripts/validar_deploy_vm.sh` | Validação na VM |

---

## Reset VM do zero

Se precisar resetar a VM e começar do zero, preservando apenas o banco:

- **`docs/deploy/RESET_VM_DO_ZERO.md`** — Guia completo
- **`scripts/deploy/extrair_backup_vm.sh`** — Extrai o banco antes do reset

---

## Troubleshooting

- **502 Bad Gateway:** `docs/deploy/RECUPERAR_SITE_502.md`
- **HTTPS "Não seguro":** `docs/deploy/FIX_HTTPS_NAO_SEGURO.md`
- **Validação completa:** `docs/deploy/VALIDACAO_DEPLOY_SEGURO.md`
