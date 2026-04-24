#!/bin/bash
# =============================================================================
# Validação Deploy Seguro — executar NA VM
# =============================================================================
# Uso: bash scripts/validar_deploy_vm.sh
# Ou:  cd /var/www/atelie && bash scripts/validar_deploy_vm.sh
#
# Verifica: estrutura, variáveis, serviços, HTTPS, segurança
# =============================================================================

set -e

ATELIE_PATH="${ATELIE_PATH:-/var/www/atelie}"
BACKEND_PORT=8001
FRONTEND_PORT=3004
DOMAIN="gestao.atelieilmaguerra.com.br"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo "=============================================="
echo "  Validação Deploy Ateliê — $DOMAIN"
echo "=============================================="
echo ""

# 1. Estrutura
echo "--- 1. Estrutura ---"
if [ -d "$ATELIE_PATH/app_dev/backend" ]; then
  ok "Backend existe"
else
  fail "Backend não encontrado em $ATELIE_PATH/app_dev/backend"
fi
if [ -d "$ATELIE_PATH/app_dev/frontend" ]; then
  ok "Frontend existe"
else
  fail "Frontend não encontrado"
fi
if [ -d "$ATELIE_PATH/app_dev/backend/venv" ]; then
  ok "venv existe"
else
  warn "venv não encontrado — rodar: python3 -m venv venv && pip install -r requirements.txt"
fi
if [ -d "$ATELIE_PATH/app_dev/frontend/node_modules" ]; then
  ok "node_modules existe"
else
  warn "node_modules não encontrado — rodar: npm ci"
fi
if [ -d "$ATELIE_PATH/app_dev/frontend/.next" ]; then
  ok "Build .next existe"
else
  warn "Build .next não encontrado — rodar: npm run build"
fi
echo ""

# 2. Arquivos sensíveis NUNCA devem ter vindo do deploy
echo "--- 2. Arquivos sensíveis (não devem existir via deploy) ---"
for f in "$ATELIE_PATH/app_dev/backend/database/atelie.db" "$ATELIE_PATH/.env"; do
  if [ -f "$f" ]; then
    warn "$f existe — verificar se foi criado manualmente no servidor (não veio do rsync)"
  fi
done
echo ""

# 3. Variáveis de ambiente
echo "--- 3. Variáveis de ambiente ---"
if [ -f "$ATELIE_PATH/app_dev/backend/.env" ]; then
  ok ".env backend existe"
  if grep -q "JWT_SECRET_KEY=dev-secret-change-in-production" "$ATELIE_PATH/app_dev/backend/.env" 2>/dev/null; then
    fail "JWT_SECRET_KEY ainda é o valor de desenvolvimento! Gerar: openssl rand -hex 32"
  else
    ok "JWT_SECRET_KEY não é o valor de dev"
  fi
  if grep -q "DEBUG=true" "$ATELIE_PATH/app_dev/backend/.env" 2>/dev/null; then
    fail "DEBUG=true em produção!"
  else
    ok "DEBUG não está true"
  fi
  if grep -q "DATABASE_URL=postgresql" "$ATELIE_PATH/app_dev/backend/.env" 2>/dev/null; then
    ok "DATABASE_URL PostgreSQL configurado"
  else
    warn "DATABASE_URL pode estar SQLite — produção deve usar PostgreSQL"
  fi
else
  fail ".env backend NÃO existe — criar a partir de .env.example"
fi

if [ -f "$ATELIE_PATH/app_dev/frontend/.env.production" ]; then
  ok ".env.production existe"
  NEXT_URL=$(grep "NEXT_PUBLIC_BACKEND_URL" "$ATELIE_PATH/app_dev/frontend/.env.production" 2>/dev/null | cut -d= -f2-)
  if echo "$NEXT_URL" | grep -q "localhost"; then
    fail "NEXT_PUBLIC_BACKEND_URL contém localhost — usuário acessará localhost dele! Deixar vazio."
  elif [ -z "$NEXT_URL" ] || [ "$NEXT_URL" = "" ]; then
    ok "NEXT_PUBLIC_BACKEND_URL vazio (URLs relativas)"
  else
    ok "NEXT_PUBLIC_BACKEND_URL = $NEXT_URL"
  fi
else
  fail ".env.production NÃO existe — criar a partir de .env.production.example"
fi

# Permissões .env (Linux: stat -c, macOS: stat -f)
if [ -f "$ATELIE_PATH/app_dev/backend/.env" ]; then
  perms=$(stat -c "%a" "$ATELIE_PATH/app_dev/backend/.env" 2>/dev/null) || perms=$(stat -f "%A" "$ATELIE_PATH/app_dev/backend/.env" 2>/dev/null)
  if [ "$perms" = "600" ]; then
    ok ".env com permissão 600"
  else
    warn ".env com permissão $perms — recomendado: chmod 600"
  fi
fi
echo ""

# 4. Serviços systemd
echo "--- 4. Serviços ---"
if systemctl is-active --quiet atelie-backend 2>/dev/null; then
  ok "atelie-backend rodando"
else
  fail "atelie-backend NÃO está rodando — systemctl start atelie-backend"
fi
if systemctl is-active --quiet atelie-frontend 2>/dev/null; then
  ok "atelie-frontend rodando"
else
  fail "atelie-frontend NÃO está rodando — systemctl start atelie-frontend"
fi

# Portas
if ss -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT "; then
  ok "Porta $BACKEND_PORT (backend) em uso"
else
  fail "Porta $BACKEND_PORT não está escutando"
fi
if ss -tlnp 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
  ok "Porta $FRONTEND_PORT (frontend) em uso"
else
  fail "Porta $FRONTEND_PORT não está escutando"
fi
echo ""

# 5. Conectividade local
echo "--- 5. Health check local ---"
if curl -sf "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
  ok "Backend /api/health responde"
else
  fail "Backend /api/health não responde"
fi
HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$FRONTEND_PORT/" 2>/dev/null || echo "000")
if [ "$HTTP_FRONT" = "200" ]; then
  ok "Frontend responde 200"
else
  warn "Frontend retornou HTTP $HTTP_FRONT"
fi
echo ""

# 6. HTTPS (se curl disponível e domínio resolvendo)
echo "--- 6. HTTPS e redirect ---"
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" "http://$DOMAIN/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
  ok "HTTP redirect para HTTPS ($HTTP_CODE)"
elif [ "$HTTP_CODE" = "000" ]; then
  warn "Não foi possível testar HTTP (curl falhou ou DNS)"
else
  fail "HTTP retornou $HTTP_CODE — deveria ser 301 redirect"
fi

HTTPS_CODE=$(curl -sI -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null || echo "000")
if [ "$HTTPS_CODE" = "200" ]; then
  ok "HTTPS responde 200"
elif [ "$HTTPS_CODE" = "000" ]; then
  warn "Não foi possível testar HTTPS"
else
  fail "HTTPS retornou $HTTPS_CODE"
fi
echo ""

# 7. Certificado SSL
echo "--- 7. Certificado SSL ---"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT_PATH" ]; then
  ok "Certificado existe"
  if command -v openssl >/dev/null 2>&1; then
    expires=$(openssl x509 -in "$CERT_PATH" -noout -enddate 2>/dev/null | cut -d= -f2)
    echo "   Expira: $expires"
  fi
else
  warn "Certificado não encontrado em $CERT_PATH"
fi
echo ""

# 8. Firewall
echo "--- 8. Firewall UFW ---"
if command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -q "Status: active"; then
    ok "UFW ativo"
  else
    warn "UFW não está ativo"
  fi
else
  warn "UFW não instalado"
fi
echo ""

# 9. Nginx
echo "--- 9. Nginx ---"
if [ -f "/etc/nginx/sites-enabled/atelie-gestao" ]; then
  ok "Config Ateliê ativa no Nginx"
else
  warn "Config Nginx do Ateliê não encontrada (sites-enabled/atelie-gestao)"
fi
echo ""

echo "=============================================="
echo "  Fim da validação"
echo "=============================================="
echo ""
echo "Documentação: docs/deploy/VALIDACAO_DEPLOY_SEGURO.md"
