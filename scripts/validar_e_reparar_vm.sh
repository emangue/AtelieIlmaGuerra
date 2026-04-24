#!/bin/bash
# =============================================================================
# Validar e Reparar VM — executar LOCAL (SSH na VM)
# =============================================================================
# Uso: ./scripts/validar_e_reparar_vm.sh
#      VM_HOST=meu-servidor ./scripts/validar_e_reparar_vm.sh
#
# Valida o deploy na VM e tenta reparar automaticamente:
# - Reinicia backend/frontend se parados
# - Garante config Nginx ativa (copia do projeto se faltar)
# - Recarrega Nginx
# - Testa HTTPS
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar config
if [ -f "$SCRIPT_DIR/deploy/config.sh" ]; then
  source "$SCRIPT_DIR/deploy/config.sh"
fi

VM_TARGET="${VM_HOST:+root@$VM_HOST}"
if [ -z "$VM_TARGET" ]; then
  echo "❌ VM_HOST não definido. Configure em scripts/deploy/config.sh ou:"
  echo "   VM_HOST=meu-alias-ssh ./scripts/validar_e_reparar_vm.sh"
  exit 1
fi

ATELIE_PATH="${ATELIE_PATH:-/var/www/atelie}"
DOMAIN="gestao.atelieilmaguerra.com.br"

echo "=============================================="
echo "  Validar e Reparar — $DOMAIN"
echo "=============================================="
echo "  VM: $VM_TARGET"
echo "  Pasta: $ATELIE_PATH"
echo "=============================================="
echo ""

# Script remoto (executado na VM)
REMOTE_SCRIPT='
set -e
ATELIE_PATH="'"$ATELIE_PATH"'"
DOMAIN="'"$DOMAIN"'"
BACKEND_PORT=8001
FRONTEND_PORT=3004

ok()  { echo "✅ $1"; }
fail() { echo "❌ $1"; }
warn() { echo "⚠️  $1"; }

echo "--- 1. Verificando serviços ---"
BACKEND_DOWN=0
FRONTEND_DOWN=0

if ! systemctl is-active --quiet atelie-backend 2>/dev/null; then
  fail "atelie-backend parado"
  BACKEND_DOWN=1
else
  ok "atelie-backend rodando"
fi

if ! systemctl is-active --quiet atelie-frontend 2>/dev/null; then
  fail "atelie-frontend parado"
  FRONTEND_DOWN=1
else
  ok "atelie-frontend rodando"
fi

if [ $BACKEND_DOWN -eq 1 ] || [ $FRONTEND_DOWN -eq 1 ]; then
  echo ""
  echo "--- Reparando: reiniciando serviços ---"
  if systemctl list-unit-files atelie-backend.service 2>/dev/null | grep -q atelie-backend; then
    systemctl restart atelie-backend atelie-frontend
    sleep 3
  else
    fail "Units systemd não instalados. Execute: bash scripts/deploy/pos_deploy_vm.sh"
    exit 1
  fi
  if systemctl is-active --quiet atelie-backend && systemctl is-active --quiet atelie-frontend; then
    ok "Serviços reiniciados"
  else
    fail "Falha ao reiniciar. Verifique: systemctl status atelie-backend atelie-frontend"
    exit 1
  fi
fi

echo ""
echo "--- 2. Health check local ---"
if ! curl -sf "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
  fail "Backend não responde em 127.0.0.1:$BACKEND_PORT"
  echo "   Logs: journalctl -u atelie-backend -n 30 --no-pager"
  exit 1
fi
ok "Backend /api/health OK"

HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$FRONTEND_PORT/" 2>/dev/null || echo "000")
if [ "$HTTP_FRONT" != "200" ]; then
  fail "Frontend retornou HTTP $HTTP_FRONT"
  echo "   Logs: journalctl -u atelie-frontend -n 30 --no-pager"
  exit 1
fi
ok "Frontend responde 200"

echo ""
echo "--- 3. Nginx ---"
NGINX_FIX=0
if [ ! -f "/etc/nginx/sites-enabled/atelie-gestao" ]; then
  warn "Config atelie-gestao não está ativa"
  if [ -f "$ATELIE_PATH/scripts/nginx-atelie-gestao.conf" ]; then
    echo "   Copiando config do projeto..."
    sudo cp "$ATELIE_PATH/scripts/nginx-atelie-gestao.conf" /etc/nginx/sites-available/atelie-gestao
    sudo ln -sf /etc/nginx/sites-available/atelie-gestao /etc/nginx/sites-enabled/
    NGINX_FIX=1
  else
    fail "Arquivo nginx-atelie-gestao.conf não encontrado em $ATELIE_PATH/scripts/"
    exit 1
  fi
else
  ok "Config Nginx ativa"
fi

if [ $NGINX_FIX -eq 1 ] || ! sudo nginx -t 2>/dev/null; then
  echo "   Testando e recarregando Nginx..."
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    ok "Nginx recarregado"
  else
    fail "Nginx -t falhou. Verifique a config."
    sudo nginx -t
    exit 1
  fi
fi

echo ""
echo "--- 4. Teste HTTPS ---"
HTTPS_CODE=$(curl -sI -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null || echo "000")
if [ "$HTTPS_CODE" = "200" ]; then
  ok "Site respondendo: https://$DOMAIN → 200"
else
  fail "HTTPS retornou $HTTPS_CODE"
  echo "   Verifique: tail -20 /var/log/nginx/atelie_gestao_error.log"
  exit 1
fi

echo ""
echo "=============================================="
echo "  ✅ Site em linha: https://$DOMAIN"
echo "=============================================="
'

# Executar remoto
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "$VM_TARGET" "bash -s" <<< "$REMOTE_SCRIPT"

EXIT=$?
if [ $EXIT -eq 0 ]; then
  echo ""
  echo "✅ Validação concluída. Site em funcionamento."
else
  echo ""
  echo "❌ Falha na validação. Verifique os erros acima."
  exit $EXIT
fi
