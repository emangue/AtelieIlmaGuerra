#!/usr/bin/env bash
set -e

VM="minha-vps-hostinger"
REMOTE_PATH="/var/www/atelie/app_dev"
LOCAL_PATH="$(cd "$(dirname "$0")/.." && pwd)/app_dev"

echo "=== Ateliê Ilma Guerra — Deploy ==="
echo "Origem: $LOCAL_PATH"
echo "Destino: $VM:$REMOTE_PATH"
echo ""

# 1. Sync
echo "[1/3] Sincronizando arquivos..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.next' \
  --exclude='node_modules' \
  --exclude='venv/' \
  --exclude='*.db' \
  --exclude='.env' \
  --exclude='*.env' \
  --exclude='uploads/' \
  "$LOCAL_PATH/" "$VM:$REMOTE_PATH/"

# 2. Build frontend
echo "[2/3] Build frontend..."
ssh "$VM" "cd $REMOTE_PATH/frontend && npm run build 2>&1 | tail -5"

# 3. Restart serviços
echo "[3/3] Reiniciando serviços..."
ssh "$VM" "sudo systemctl restart atelie-backend atelie-frontend"
sleep 4
ssh "$VM" "sudo systemctl status atelie-backend atelie-frontend --no-pager | grep -E 'Active|●'"

echo ""
echo "=== Deploy concluído ==="
