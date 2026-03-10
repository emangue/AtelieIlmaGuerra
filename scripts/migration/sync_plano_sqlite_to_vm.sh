#!/bin/bash
# =============================================================================
# Sincroniza plano_itens e despesas_transacoes do SQLite local para a VM
# (quando a VM usa SQLite em produção)
#
# Uso: ./scripts/migration/sync_plano_sqlite_to_vm.sh [VM_HOST]
# Ex:  ./scripts/migration/sync_plano_sqlite_to_vm.sh
#      ./scripts/migration/sync_plano_sqlite_to_vm.sh minha-vps-hostinger
# =============================================================================

set -e

VM_HOST="${1:-minha-vps-hostinger}"
ATELIE_PATH="${ATELIE_PATH:-/var/www/atelie}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL_DB="${PROJECT_ROOT}/app_dev/backend/database/atelie.db"
REMOTE_DB="${ATELIE_PATH}/app_dev/backend/database/atelie.db"

if [ ! -f "$LOCAL_DB" ]; then
  echo "❌ Banco local não encontrado: $LOCAL_DB"
  exit 1
fi

echo "=============================================="
echo "  Sync Plano: Local SQLite → VM SQLite"
echo "=============================================="
echo "  Local:  $LOCAL_DB"
echo "  VM:     $VM_HOST"
echo "  Dest:   $REMOTE_DB"
echo "=============================================="
echo ""

# 1. Copiar banco local para /tmp na VM
echo "📤 Copiando banco local para a VM..."
scp -o ConnectTimeout=10 "$LOCAL_DB" "${VM_HOST}:/tmp/atelie_plano_sync.db"

# 2. Na VM: rodar migração (plano do arquivo copiado → banco de prod)
echo ""
echo "🔄 Migrando plano na VM..."
ssh -o ConnectTimeout=10 "$VM_HOST" "cd $ATELIE_PATH && \
  source app_dev/backend/venv/bin/activate && \
  ATELIE_SQLITE_PATH=/tmp/atelie_plano_sync.db \
  ATELIE_SQLITE_DEST=$REMOTE_DB \
  python scripts/migration/migrate_plano_to_prod.py --yes"

# 3. Limpar arquivo temporário na VM
ssh -o ConnectTimeout=5 "$VM_HOST" "rm -f /tmp/atelie_plano_sync.db" 2>/dev/null || true

echo ""
echo "✅ Plano sincronizado com sucesso."
