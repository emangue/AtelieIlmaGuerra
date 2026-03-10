# 🔧 Recuperar Site 502 - Gestão Ateliê

**Sintoma:** Site retorna 502 Bad Gateway em https://gestao.atelieilmaguerra.com.br

**Causa:** O Nginx não consegue conectar ao upstream (frontend porta 3004 ou backend porta 8001). Os serviços provavelmente pararam.

**Nginx em Docker:** Se o Nginx roda em container Docker, o backend precisa escutar em `0.0.0.0` (não `127.0.0.1`), pois o container acessa o host via IP da rede Docker (ex.: 172.20.0.1). O template `scripts/deploy/atelie-backend.service` já usa `--host 0.0.0.0`.

**Importante:** Em produção, `NEXT_PUBLIC_BACKEND_URL` deve estar **vazio** para usar URLs relativas. Se estiver `http://localhost:8000`, o navegador do usuário tentará acessar localhost no PC dele — não no servidor — e falhará.

---

## 0. Validação automática (recomendado)

Execute **na sua máquina** (com SSH configurado):

```bash
./scripts/validar_e_reparar_vm.sh
```

O script conecta na VM via SSH, verifica serviços, reinicia se necessário, garante a config do Nginx e testa o site. Se algo estiver fora do esperado, tenta reparar automaticamente.

---

## 1. Verificar e reiniciar serviços (no servidor)

```bash
# Conectar ao servidor
ssh deploy@SEU_IP_VPS
# ou: ssh root@SEU_IP_VPS

# Verificar status dos serviços
sudo systemctl status atelie-backend
sudo systemctl status atelie-frontend

# Se estiverem inativos, reiniciar
sudo systemctl restart atelie-backend
sudo systemctl restart atelie-frontend

# Verificar se as portas estão escutando
ss -tlnp | grep -E '8001|3004'
# Deve mostrar: 8001 (backend) e 3004 (frontend)
```

---

## 2. Se os serviços não existirem (systemd)

Crie os unit files conforme o `GUIA_DEPLOY_GESTAO.md` seção 4.3 e 4.4.

**Backend (porta 8001):**
```bash
# /etc/systemd/system/atelie-backend.service
[Unit]
Description=Ateliê Ilma Guerra - FastAPI Backend
After=network.target postgresql.service

[Service]
User=deploy
WorkingDirectory=/var/www/atelie/app_dev/backend
Environment="PATH=/var/www/atelie/app_dev/backend/venv/bin"
# 0.0.0.0 necessário quando Nginx está em Docker (acessa host via 172.20.0.1)
ExecStart=/var/www/atelie/app_dev/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Frontend (porta 3004):**
```bash
# /etc/systemd/system/atelie-frontend.service
[Unit]
Description=Ateliê Ilma Guerra - Next.js Frontend
After=network.target

[Service]
User=deploy
WorkingDirectory=/var/www/atelie/app_dev/frontend
Environment="NODE_ENV=production"
Environment="PORT=3004"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Depois:
```bash
sudo systemctl daemon-reload
sudo systemctl enable atelie-backend atelie-frontend
sudo systemctl start atelie-backend atelie-frontend
```

---

## 3. Verificar variáveis de ambiente (conexão)

**Frontend** – `app_dev/frontend/.env.production`:
```bash
# Para produção no mesmo domínio (recomendado)
NEXT_PUBLIC_BACKEND_URL=
NODE_ENV=production
```

**Importante:** Se `NEXT_PUBLIC_BACKEND_URL` estiver com `http://localhost:8000` ou `http://localhost:8001`, o site vai quebrar no navegador (o usuário não tem backend no localhost dele). Deixe **vazio** para usar URLs relativas.

Após alterar `.env.production`, **reconstrua o frontend**:
```bash
cd /var/www/atelie/app_dev/frontend
npm run build
sudo systemctl restart atelie-frontend
```

---

## 4. Testar conectividade local

```bash
# No servidor
curl -s http://127.0.0.1:8001/api/health
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3004/
```

Se ambos retornarem 200, o Nginx deve conseguir fazer proxy.

---

## 5. Logs para diagnóstico

```bash
# Logs do Nginx
sudo tail -50 /var/log/nginx/atelie_gestao_error.log

# Logs dos serviços
sudo journalctl -u atelie-backend -n 50 --no-pager
sudo journalctl -u atelie-frontend -n 50 --no-pager
```
