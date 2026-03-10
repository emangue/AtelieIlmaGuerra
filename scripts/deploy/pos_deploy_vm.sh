#!/bin/bash
# =============================================================================
# Pós-deploy — executar NA VM após scripts/deploy.sh
# =============================================================================
# Uso: cd /var/www/atelie && bash scripts/deploy/pos_deploy_vm.sh
#
# Faz: venv, pip install, npm ci, npm run build, systemd, restart
# NÃO sobrescreve .env e .env.production se já existirem
# =============================================================================

set -e

ATELIE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="$ATELIE_PATH/app_dev/backend"
FRONTEND="$ATELIE_PATH/app_dev/frontend"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

echo "=== Pós-deploy Ateliê ==="
echo "Pasta: $ATELIE_PATH"
echo ""

# 1. Backend — venv e dependências
echo "1. Backend (venv + pip)..."
cd "$BACKEND"
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "   venv criado"
fi
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "   OK"
echo ""

# 2. Frontend — npm e build
echo "2. Frontend (npm ci + build)..."
cd "$FRONTEND"
if [ ! -d "node_modules" ]; then
  npm ci
  echo "   node_modules instalado"
fi
npm run build
echo "   OK"
echo ""

# 3. Variáveis de ambiente (não sobrescrever)
echo "3. Variáveis de ambiente..."
if [ ! -f "$BACKEND/.env" ]; then
  if [ -f "$BACKEND/.env.example" ]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    echo "   .env criado a partir de .env.example"
    echo "   ⚠️  EDITE: JWT_SECRET_KEY, DATABASE_URL, DEBUG=false"
  else
    echo "   AVISO: .env.example não encontrado"
  fi
else
  echo "   .env já existe (não sobrescrito)"
fi

if [ ! -f "$FRONTEND/.env.production" ]; then
  if [ -f "$FRONTEND/.env.production.example" ]; then
    cp "$FRONTEND/.env.production.example" "$FRONTEND/.env.production"
    echo "   .env.production criado"
  else
    echo "NEXT_PUBLIC_BACKEND_URL=" > "$FRONTEND/.env.production"
    echo "NODE_ENV=production" >> "$FRONTEND/.env.production"
    echo "   .env.production criado"
  fi
else
  echo "   .env.production já existe (não sobrescrito)"
fi
echo ""

# 4. Systemd (se root e units existem)
echo "4. Systemd..."
if [ "$(id -u)" -eq 0 ] && [ -f "$ATELIE_PATH/scripts/deploy/atelie-backend.service" ]; then
  cp "$ATELIE_PATH/scripts/deploy/atelie-backend.service" /etc/systemd/system/
  cp "$ATELIE_PATH/scripts/deploy/atelie-frontend.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable atelie-backend atelie-frontend 2>/dev/null || true
  echo "   Units instalados"
else
  echo "   (Execute como root para instalar systemd units)"
fi
echo ""

# 5. Permissões (se deploy user existe)
if id "$DEPLOY_USER" &>/dev/null && [ "$(id -u)" -eq 0 ]; then
  echo "5. Permissões (chown $DEPLOY_USER)..."
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ATELIE_PATH"
  chmod 600 "$BACKEND/.env" 2>/dev/null || true
  echo "   OK"
else
  echo "5. (Usuário $DEPLOY_USER não encontrado ou não é root)"
fi
echo ""

# 6. Restart serviços
echo "6. Reiniciando serviços..."
if systemctl is-active --quiet atelie-backend 2>/dev/null; then
  systemctl restart atelie-backend
  echo "   atelie-backend reiniciado"
fi
if systemctl is-active --quiet atelie-frontend 2>/dev/null; then
  systemctl restart atelie-frontend
  echo "   atelie-frontend reiniciado"
fi
if ! systemctl is-active --quiet atelie-backend 2>/dev/null; then
  echo "   Iniciando serviços..."
  systemctl start atelie-backend atelie-frontend 2>/dev/null || true
fi
echo ""

echo "=== Concluído ==="
echo ""
echo "Validação: bash $ATELIE_PATH/scripts/validar_deploy_vm.sh"
echo ""
