#!/bin/bash
# =============================================================================
# Extrair backup do banco da VM (antes de resetar)
# =============================================================================
# Uso: bash scripts/deploy/extrair_backup_vm.sh
#      bash scripts/deploy/extrair_backup_vm.sh [destino_local]
#
# Detecta SQLite ou PostgreSQL automaticamente.
# Gera: atelie_db_YYYY-MM-DD_HH-MM-SS.db.gz ou .sql.gz
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SCRIPT_DIR/config.sh" ] && source "$SCRIPT_DIR/config.sh"

VM_HOST="${VM_HOST:-minha-vps-hostinger}"
VM_TARGET="root@${VM_HOST}"

DEST_DIR="${1:-.}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
ATELIE_PATH="${ATELIE_PATH:-/var/www/atelie}"
ENV_FILE="$ATELIE_PATH/app_dev/backend/.env"
DB_PATH="$ATELIE_PATH/app_dev/backend/database/atelie.db"

echo "=== Extrair backup da VM ==="
echo "Origem: $VM_TARGET"
echo ""

# Detectar tipo de banco (SQLite ou PostgreSQL)
DB_TYPE=$(ssh "$VM_TARGET" "
  if [ -f \"$ENV_FILE\" ]; then
    if grep -q '^DATABASE_URL=postgresql' \"$ENV_FILE\" 2>/dev/null; then
      echo 'postgresql'
    elif [ -f \"$DB_PATH\" ]; then
      echo 'sqlite'
    fi
  fi
  [ -f \"$DB_PATH\" ] && echo 'sqlite'
" 2>/dev/null | tail -1)

if [ "$DB_TYPE" = "sqlite" ]; then
  echo "Banco detectado: SQLite"
  FILENAME="atelie_db_${TIMESTAMP}.db.gz"
  LOCAL_FILE="${DEST_DIR}/${FILENAME}"
  echo "Destino: $LOCAL_FILE"
  echo ""
  echo "Extraindo SQLite..."
  ssh "$VM_TARGET" "gzip -c $DB_PATH" > "$LOCAL_FILE"
  echo ""
  echo "✅ Backup extraído: $LOCAL_FILE ($(ls -lh "$LOCAL_FILE" | awk '{print $5}'))"
  echo ""
  echo "Para restaurar após o reset da VM:"
  echo "  scp $LOCAL_FILE root@VM:/tmp/"
  echo "  ssh root@VM 'gunzip -c /tmp/atelie_db_*.db.gz > $ATELIE_PATH/app_dev/backend/database/atelie.db'"
  echo "  ssh root@VM 'chown deploy:deploy $ATELIE_PATH/app_dev/backend/database/atelie.db'"
  exit 0
fi

# PostgreSQL
echo "Banco detectado: PostgreSQL"
FILENAME="atelie_db_${TIMESTAMP}.sql.gz"
LOCAL_FILE="${DEST_DIR}/${FILENAME}"
echo "Destino: $LOCAL_FILE"
echo ""
echo "Executando pg_dump na VM..."
ssh "$VM_TARGET" "
  ENV_FILE='$ENV_FILE'
  if [ -f \"\$ENV_FILE\" ]; then
    DB_URL=\$(grep '^DATABASE_URL=' \"\$ENV_FILE\" | cut -d= -f2- | tr -d '\"' | tr -d \"'\")
    if [[ \"\$DB_URL\" == postgresql://* ]]; then
      pg_dump \"\$DB_URL\" 2>/dev/null | gzip
      exit 0
    fi
  fi
  sudo -u postgres pg_dump atelie_db 2>/dev/null | gzip
" > "$LOCAL_FILE"

if [ ! -s "$LOCAL_FILE" ]; then
  echo "❌ Falha: arquivo vazio ou erro no pg_dump"
  rm -f "$LOCAL_FILE"
  exit 1
fi

SIZE=$(ls -lh "$LOCAL_FILE" | awk '{print $5}')
echo "✅ Backup extraído: $LOCAL_FILE ($SIZE)"
echo ""
echo "Para restaurar após o reset da VM:"
echo "  gunzip -c $LOCAL_FILE | PGPASSWORD=SENHA psql -h 127.0.0.1 -U atelie_user atelie_db"
echo ""
