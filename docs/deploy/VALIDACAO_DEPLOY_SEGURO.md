# Validação Deploy Seguro — Local vs VM

**Objetivo:** Garantir que o projeto na VM esteja alinhado com o local e que o deploy seja feito de forma segura (HTTPS, variáveis sensíveis, headers de segurança).

---

## 1. RESUMO EXECUTIVO

| Categoria | Status Local | O que validar na VM |
|-----------|--------------|---------------------|
| **Código** | ✅ | Mesmo commit/branch que local |
| **Variáveis de ambiente** | ⚠️ | `.env` e `.env.production` criados manualmente |
| **HTTPS/SSL** | ✅ | Certificado válido, redirect 301 |
| **Headers de segurança** | ⚠️ | HSTS, X-Frame-Options no Nginx |
| **Portas** | ✅ | Backend 8001, Frontend 3004 |
| **Firewall** | N/A | UFW: 22, 80, 443 |
| **JWT/Cookie** | ✅ | Secure, HttpOnly em prod |

---

## 2. ARQUITETURA DE DEPLOY

O Ateliê roda de forma **independente** na VM:

- **Nginx do sistema** nas portas 80/443 faz proxy para backend (8001) e frontend (3004)
- Backend e frontend rodam via systemd
- Config: `scripts/nginx-atelie-gestao.conf` → `/etc/nginx/sites-available/atelie-gestao`

---

## 3. CHECKLIST PONTO A PONTO — O QUE PODE FALTAR NA VM

### 3.1. Código e Estrutura

| Item | Local | VM | Comando de verificação |
|------|-------|-----|------------------------|
| Estrutura `/var/www/atelie/` | ✅ | ? | `ls -la /var/www/atelie/app_dev/{backend,frontend}` |
| `.deployignore` respeitado | ✅ | ? | Nenhum `.env`, `*.db`, `uploads/` na pasta |
| `node_modules` e `venv` | Instalados no servidor | ? | `ls app_dev/backend/venv app_dev/frontend/node_modules` |
| Build frontend `.next/` | Gerado no servidor | ? | `ls app_dev/frontend/.next` |

### 3.2. Variáveis de Ambiente (CRÍTICO — nunca vêm do deploy)

| Arquivo | Local | VM | O que deve ter |
|---------|-------|-----|----------------|
| `app_dev/backend/.env` | ❌ não commitado | Criar manualmente | `DEBUG=false`, `JWT_SECRET_KEY` único, `DATABASE_URL` PostgreSQL, `BACKEND_CORS_ORIGINS` |
| `app_dev/frontend/.env.production` | ❌ não commitado | Criar manualmente | `NEXT_PUBLIC_BACKEND_URL=` (vazio), `NODE_ENV=production` |

**Comando na VM:**
```bash
# Backend
test -f /var/www/atelie/app_dev/backend/.env && echo "OK" || echo "FALTA .env"
grep -q "JWT_SECRET_KEY=dev-secret" /var/www/atelie/app_dev/backend/.env 2>/dev/null && echo "PERIGO: JWT em dev" || echo "OK"
grep -q "DEBUG=false" /var/www/atelie/app_dev/backend/.env 2>/dev/null && echo "OK" || echo "DEBUG pode estar true"

# Frontend
test -f /var/www/atelie/app_dev/frontend/.env.production && echo "OK" || echo "FALTA .env.production"
grep "NEXT_PUBLIC_BACKEND_URL" /var/www/atelie/app_dev/frontend/.env.production
# Deve estar vazio ou https://gestao.atelieilmaguerra.com.br (nunca localhost)
```

### 3.3. Serviços systemd

| Serviço | Porta | Local | VM |
|---------|-------|-------|-----|
| atelie-backend | 8001 | - | `systemctl status atelie-backend` |
| atelie-frontend | 3004 | - | `systemctl status atelie-frontend` |

**IMPORTANTE:** O GUIA_DEPLOY_GESTAO.md usa portas 3000 e 8000 nos exemplos de systemd, mas a produção usa **3004** e **8001**. Os unit files na VM devem ter:
- Backend: `--port 8001`
- Frontend: `Environment="PORT=3004"`

### 3.4. Nginx e HTTPS

| Item | Config Local | VM |
|------|--------------|-----|
| Redirect HTTP→HTTPS | 301 | `curl -sI http://gestao.atelieilmaguerra.com.br \| head -3` |
| HTTPS responde 200 | - | `curl -sI https://gestao.atelieilmaguerra.com.br \| head -3` |
| Certificado válido | - | `openssl x509 -in /etc/letsencrypt/live/gestao.../fullchain.pem -noout -dates` |
| HSTS | `Strict-Transport-Security` | Presente em `nginx-atelie-gestao.conf` |
| X-Frame-Options | `SAMEORIGIN` ou `DENY` | Presente em `nginx-atelie-gestao.conf` |
| location /_next/static/ | Evita 400 e MIME errado | Presente em `nginx-atelie-gestao.conf` |

### 3.5. Arquivos de Segurança no Repositório

| Arquivo | Função |
|---------|--------|
| `scripts/nginx-atelie-gestao.conf` | Config Nginx — HSTS, X-Frame-Options, /_next/static/ |
| `.deployignore` | Lista de exclusões no rsync — nunca envia .env, *.db, uploads |

### 3.6. Estado Atual do Código (segurança/HTTPS)

| Arquivo | Estado |
|---------|--------|
| `middleware.ts` | Protege rotas /mobile; redirect HTTP→HTTPS é feito pelo Nginx |
| `next.config.ts` | Headers X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| `nginx-atelie-gestao.conf` | HSTS, X-Frame-Options, location /_next/static/ |

**Nota:** O redirect HTTP→HTTPS é feito pelo **Nginx** (return 301). HSTS é configurado no Nginx (termina SSL). O Next.js adiciona headers extras como camada de defesa.

---

## 4. SEGURANÇA — CHECKLIST FINAL

### 4.1. Backend
- [ ] `DEBUG=false`
- [ ] `JWT_SECRET_KEY` único (64+ chars, `openssl rand -hex 32`)
- [ ] `BACKEND_CORS_ORIGINS` = `https://gestao.atelieilmaguerra.com.br`
- [ ] Backend escuta em `0.0.0.0` (obrigatório quando Nginx está em Docker; porta 8001 não exposta ao público)
- [ ] `.env` com `chmod 600`
- [ ] `DATABASE_URL` com PostgreSQL em produção (não SQLite)

### 4.2. Frontend
- [ ] `NEXT_PUBLIC_BACKEND_URL=` vazio (URLs relativas)
- [ ] `npm run build` após alterar .env.production
- [ ] Cookie `auth_token`: Secure, HttpOnly, SameSite=strict (código já faz quando DEBUG=false)

### 4.3. Infraestrutura
- [ ] UFW: apenas 22, 80, 443
- [ ] Certificado Let's Encrypt válido
- [ ] Fail2ban ativo (anti força-bruta)
- [ ] Nginx com HSTS e X-Frame-Options

### 4.4. Arquivos NUNCA na VM via deploy
- `.env`, `.env.production`
- `*.db`, `database/`
- `uploads/`
- `*.xlsx`, `*.pdf`, `*.docx`
- `*.pem`, `*.key`

---

## 5. SCRIPT DE VALIDAÇÃO NA VM

Execute na VM para validar tudo de uma vez:

```bash
bash /var/www/atelie/scripts/validar_deploy_vm.sh
```

Ou copie o conteúdo de `scripts/validar_deploy_vm.sh` e execute.

---

## 6. FLUXO DE DEPLOY SEGURO

Ver **`docs/deploy/PLANO_DEPLOY.md`** para o plano completo.

**Resumo:**
1. **Local:** `./scripts/deploy.sh` (ou `./scripts/deploy.sh IP`)
2. **VM:** `cd /var/www/atelie && bash scripts/deploy/pos_deploy_vm.sh`
3. **VM:** Criar `.env` e `.env.production` manualmente (1ª vez; pos_deploy cria a partir dos .example)
4. **VM:** Copiar `nginx-atelie-gestao.conf` para `/etc/nginx/sites-available/atelie-gestao` e recarregar nginx
5. **Validar:** `bash scripts/validar_deploy_vm.sh`

---

## 7. REFERÊNCIAS

- `docs/deploy/PLANO_DEPLOY.md` — Plano unificado de deploy
- `docs/deploy/GUIA_DEPLOY_GESTAO.md` — Guia completo
- `docs/deploy/FIX_HTTPS_NAO_SEGURO.md` — Troubleshooting HTTPS
- `docs/deploy/RECUPERAR_SITE_502.md` — Recuperar 502
