# Reset VM e Deploy do Zero

Guia para resetar a VM completamente e subir o Ateliê do zero, **preservando apenas o banco de dados**.

---

## Visão geral

```
1. Extrair backup do banco (VM → local)
2. Resetar VM (painel Hostinger ou reinstalar)
3. Configurar VM do zero (Ubuntu, PostgreSQL, Nginx, etc.)
4. Deploy do código
5. Restaurar banco
6. Validar
```

---

## Fase 1 — Extrair o banco (ANTES do reset)

### 1.1. Executar script de extração

```bash
# Na sua máquina (dentro do AtelieIlmaGuerra)
./scripts/deploy/extrair_backup_vm.sh
```

Isso gera `atelie_db_YYYY-MM-DD_HH-MM-SS.sql.gz` na pasta atual.

**Alternativa manual** (se o script falhar):

```bash
# Na VM
ssh root@minha-vps-hostinger

# Verificar se .env tem DATABASE_URL
grep DATABASE_URL /var/www/atelie/app_dev/backend/.env

# Dump manual (substitua SENHA pela senha do atelie_user)
sudo -u postgres pg_dump atelie_db | gzip > /tmp/atelie_backup.sql.gz

# Na sua máquina: baixar o arquivo
scp root@minha-vps-hostinger:/tmp/atelie_backup.sql.gz ./atelie_db_backup.sql.gz
```

### 1.2. (Opcional) Extrair pasta uploads (fotos de pedidos)

Se quiser preservar as fotos dos pedidos:

```bash
scp -r root@minha-vps-hostinger:/var/www/atelie/app_dev/backend/uploads ./uploads_backup
```

### 1.3. Guardar em local seguro

Copie o `.sql.gz` (e `uploads_backup/` se extraiu) para um lugar seguro (Drive, pendrive).

---

## Fase 2 — Resetar a VM

### Opção A — Painel Hostinger

1. Acesse hPanel → VPS
2. Selecione sua VPS
3. **Reinstalar** ou **Formatar** (conforme disponível)
4. Escolha **Ubuntu 22.04** (ou a imagem limpa que preferir)

### Opção B — Manual (se tiver acesso ao console)

```bash
# Se preferir reinstalar manualmente via SSH (destrutivo)
# Cuidado: isso apaga tudo
```

---

## Fase 3 — Configurar VM do zero

Após o reset, a VM estará limpa. Siga o **GUIA_DEPLOY_GESTAO.md** seções 3 e 4:

### 3.1. Básico

```bash
ssh root@SEU_IP_VPS

apt update && apt upgrade -y
apt install -y curl git ufw nginx certbot python3-certbot-nginx postgresql
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
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 3.4. PostgreSQL e banco

```bash
sudo -u postgres psql -c "CREATE DATABASE atelie_db;"
sudo -u postgres psql -c "CREATE USER atelie_user WITH ENCRYPTED PASSWORD 'SENHA_FORTE';"
sudo -u postgres psql -d atelie_db -c "GRANT ALL PRIVILEGES ON DATABASE atelie_db TO atelie_user;"
sudo -u postgres psql -d atelie_db -c "GRANT ALL ON SCHEMA public TO atelie_user;"
```

### 3.5. Estrutura de pastas

```bash
mkdir -p /var/www/atelie
chown deploy:deploy /var/www/atelie
```

---

## Fase 4 — Deploy do código

```bash
# Na sua máquina
./scripts/deploy.sh

# Na VM (após o deploy)
ssh root@minha-vps-hostinger
cd /var/www/atelie && bash scripts/deploy/pos_deploy_vm.sh
```

### 4.1. Criar .env e .env.production

**Backend** — `/var/www/atelie/app_dev/backend/.env`:

```
DEBUG=false
DATABASE_URL=postgresql://atelie_user:SENHA_FORTE@127.0.0.1:5432/atelie_db
BACKEND_CORS_ORIGINS="https://gestao.atelieilmaguerra.com.br"
HOST=127.0.0.1
PORT=8001
JWT_SECRET_KEY=<openssl rand -hex 32>
```

**Frontend** — `/var/www/atelie/app_dev/frontend/.env.production`:

```
NEXT_PUBLIC_BACKEND_URL=
NODE_ENV=production
```

---

## Fase 5 — Restaurar o banco

### SQLite (se o backup for .db.gz)

```bash
# Na sua máquina: enviar o backup
scp atelie_db_*.db.gz root@minha-vps-hostinger:/tmp/

# Na VM: restaurar
ssh root@minha-vps-hostinger
mkdir -p /var/www/atelie/app_dev/backend/database
gunzip -c /tmp/atelie_db_*.db.gz > /var/www/atelie/app_dev/backend/database/atelie.db
chown deploy:deploy /var/www/atelie/app_dev/backend/database/atelie.db
systemctl restart atelie-backend
```

### PostgreSQL (se o backup for .sql.gz)

```bash
scp atelie_db_*.sql.gz root@minha-vps-hostinger:/tmp/
ssh root@minha-vps-hostinger
gunzip -c /tmp/atelie_db_*.sql.gz | sudo -u postgres psql -d atelie_db
systemctl restart atelie-backend
```

---

## Fase 6 — Nginx e SSL

```bash
# Certificado (primeira vez)
certbot certonly --webroot -w /var/www/html -d gestao.atelieilmaguerra.com.br

# Config Nginx
cp /var/www/atelie/scripts/nginx-atelie-gestao.conf /etc/nginx/sites-available/atelie-gestao
ln -sf /etc/nginx/sites-available/atelie-gestao /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Fase 7 — Validação

```bash
# Na VM
bash /var/www/atelie/scripts/validar_deploy_vm.sh

# Externo
curl -sI https://gestao.atelieilmaguerra.com.br
curl -s https://gestao.atelieilmaguerra.com.br/api/health
```

---

## Checklist resumido

| # | Ação |
|---|------|
| 1 | `./scripts/deploy/extrair_backup_vm.sh` — extrair banco |
| 2 | Guardar o `.sql.gz` em local seguro |
| 3 | Resetar VM (painel Hostinger) |
| 4 | Configurar VM: apt, deploy, postgres, firewall |
| 5 | `./scripts/deploy.sh` — deploy código |
| 6 | `pos_deploy_vm.sh` na VM |
| 7 | Criar .env e .env.production |
| 8 | Restaurar banco (gunzip + psql) |
| 9 | Nginx + SSL |
| 10 | Validar |

---

## Referências

- `docs/deploy/PLANO_DEPLOY.md` — Fluxo de deploy
- `docs/deploy/GUIA_DEPLOY_GESTAO.md` — Guia completo
- `docs/deploy/VALIDACAO_DEPLOY_SEGURO.md` — Checklist de segurança
