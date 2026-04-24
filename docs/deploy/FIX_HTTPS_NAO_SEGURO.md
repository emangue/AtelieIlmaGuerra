# Remover aviso "Não seguro" — gestao.atelieilmaguerra.com.br

**Sintoma:** O navegador mostra "Não seguro" (cadeado vermelho) na barra de endereço.

**Causas possíveis:**
1. Site sendo acessado via **HTTP** em vez de HTTPS
2. Certificado SSL inválido ou expirado
3. **Mixed content** — página HTTPS carregando recursos HTTP

---

## Checklist de validação (no servidor)

### 1. Verificar redirect HTTP → HTTPS

```bash
# Deve retornar 301 e Location: https://...
curl -sI http://gestao.atelieilmaguerra.com.br | head -5
```

Se retornar `200` ou `502` em vez de `301`, o Nginx **não está redirecionando** HTTP para HTTPS.

### 2. Verificar HTTPS

```bash
# Deve retornar 200
curl -sI https://gestao.atelieilmaguerra.com.br | head -5
```

### 3. Verificar certificado SSL

```bash
# Verificar validade do certificado
sudo openssl x509 -in /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br/fullchain.pem -noout -dates
```

### 4. Qual config do Nginx está ativa?

```bash
ls -la /etc/nginx/sites-enabled/
# Deve ter: atelie-gestao -> ../sites-available/atelie-gestao
```

---

## Correções aplicadas no repositório

| Arquivo | Alteração |
|---------|-----------|
| `app_dev/frontend/src/middleware.ts` | Redirect HTTP→HTTPS; matcher restrito (evita 400 em `/_next/static`) |
| `app_dev/frontend/next.config.ts` | Headers de segurança (HSTS, X-Frame-Options, etc.) |
| `scripts/nginx-atelie-gestao.conf` | Bloco HTTP com `return 301 https://...`; location `/_next/static/` explícito |

---

## Passos para aplicar no servidor

```bash
# 1. Copiar config atualizada
sudo cp /var/www/atelie/scripts/nginx-atelie-gestao.conf /etc/nginx/sites-available/atelie-gestao

# 2. Ativar (se não estiver)
sudo ln -sf /etc/nginx/sites-available/atelie-gestao /etc/nginx/sites-enabled/

# 3. Testar e recarregar
sudo nginx -t && sudo systemctl reload nginx
```

---

## Rebuild do frontend (obrigatório)

As alterações no middleware e next.config exigem rebuild:

```bash
cd /var/www/atelie/app_dev/frontend
npm run build
sudo systemctl restart atelie-frontend
```

---

## Variável de ambiente (evitar mixed content)

Em produção, `NEXT_PUBLIC_BACKEND_URL` deve estar **vazio** para usar URLs relativas (`/api/v1/...`). Se estiver `http://...`, o navegador carregará recursos via HTTP em página HTTPS → "Não seguro".

```bash
# app_dev/frontend/.env.production
NEXT_PUBLIC_BACKEND_URL=
NODE_ENV=production
```

---

## Renovação do certificado (Let's Encrypt)

```bash
sudo certbot renew --dry-run   # Teste
sudo certbot renew             # Renovar
sudo systemctl reload nginx
```
