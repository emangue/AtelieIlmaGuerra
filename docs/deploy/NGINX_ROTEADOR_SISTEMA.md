# Nginx do Sistema como Roteador (Apps Independentes)

Arquitetura onde o **Nginx do sistema** fica na frente, usa as portas 80/443 e roteia para os apps. FinUp e Ateliê ficam independentes.

```
Internet (HTTPS) → Nginx do SISTEMA (80/443, termina SSL)
                        ├── meufinup.com.br     → 127.0.0.1:8080 (Docker FinUp)
                        ├── admin.meufinup.com.br → 127.0.0.1:8080
                        └── gestao.atelie...    → 127.0.0.1:3004 e 8001 (Ateliê)
```

**Vantagens:** Se o Docker cair, o Ateliê continua. Se o Ateliê cair, o FinUp continua.

---

## Pré-requisitos

- Certificados em `/etc/letsencrypt/` para os 3 domínios (meufinup, admin.meufinup, gestao.atelie)
- Se os certs do meufinup/admin estiverem só no Docker, copie para o sistema:
  ```bash
  sudo cp -rL /caminho/ProjetoFinancasV5/certbot/conf/live/meufinup.com.br /etc/letsencrypt/live/
  sudo cp -rL /caminho/ProjetoFinancasV5/certbot/conf/live/admin.meufinup.com.br /etc/letsencrypt/live/
  ```

---

## Passos no servidor

### 1. Parar o Docker (libera 80/443)

```bash
cd /caminho/ProjetoFinancasV5
docker compose -f docker-compose.prod.yml down
```

### 2. Atualizar o ProjetoFinancasV5

O `docker-compose.prod.yml` agora usa `8080:80` (não 80 e 443). O `app.conf` do Nginx Docker foi ajustado para HTTP.

```bash
git pull   # ou rsync do seu deploy
```

### 3. Subir o Docker (agora na 8080)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Confirme que a porta 8080 está em uso:
```bash
ss -tlnp | grep 8080
```

### 4. Instalar/configurar o Nginx do sistema

```bash
# Copiar config
sudo cp /caminho/AtelieIlmaGuerra/scripts/nginx-roteador-sistema.conf /etc/nginx/sites-available/roteador

# Remover configs antigas que conflitam (se houver)
sudo rm -f /etc/nginx/sites-enabled/default
# Mantenha apenas o roteador

# Ativar
sudo ln -sf /etc/nginx/sites-available/roteador /etc/nginx/sites-enabled/

# Testar e recarregar
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Habilitar e iniciar o Nginx do sistema

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

---

## Verificação

```bash
# Nginx do sistema
curl -sI https://gestao.atelieilmaguerra.com.br | head -5
curl -sI https://meufinup.com.br | head -5

# Serviços locais
curl -s http://127.0.0.1:8080/ -H "Host: meufinup.com.br" | head -3
curl -s http://127.0.0.1:3004/ | head -3
curl -s http://127.0.0.1:8001/api/health
```

---

## Certbot (renovação SSL)

O certbot do sistema usa `/var/www/html` para o challenge. Certifique-se de que o Nginx tem:

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/html;
    try_files $uri =404;
}
```

Renovação manual:
```bash
sudo certbot renew --dry-run
```

O cron do certbot (`/etc/cron.d/certbot`) já deve estar configurado.

---

## Resumo de alterações

| Projeto | Alteração |
|---------|-----------|
| **ProjetoFinancasV5** | `docker-compose`: 8080:80 (não 80/443) |
| **ProjetoFinancasV5** | `app.conf`: port 80 serve conteúdo (sem SSL) |
| **AtelieIlmaGuerra** | `nginx-roteador-sistema.conf`: config completa para os 3 domínios |
