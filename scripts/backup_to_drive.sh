#!/bin/bash
# ============================================================
# Backup diário do banco SQLite → Google Drive
# Ateliê Ilma Guerra
#
# Uso manual: bash /var/www/atelie/scripts/backup_to_drive.sh
# Cron (03:00 diário): 0 3 * * * /var/www/atelie/scripts/backup_to_drive.sh
# ============================================================

set -euo pipefail

# ── Configurações ────────────────────────────────────────────
BACKUP_DIR="/var/backups/atelie"
ENV_FILE="/var/www/atelie/app_dev/backend/.env"
RCLONE_REMOTE="gdrive"
RCLONE_FOLDER="backups-atelie"
RETENTION_DAYS=30
LOG_FILE="/var/log/atelie-backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILENAME="atelie_db_${TIMESTAMP}.db.gz"
# ─────────────────────────────────────────────────────────────

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

die() {
  log "ERRO: $*"
  exit 1
}

log "===== Iniciando backup ====="

# Verificações de pré-requisitos
[ -f "$ENV_FILE" ] || die ".env não encontrado em $ENV_FILE"
command -v rclone  >/dev/null 2>&1 || die "rclone não instalado"
command -v gzip    >/dev/null 2>&1 || die "gzip não instalado"

# Lê DATABASE_PATH do .env
DB_PATH=$(grep -E "^DATABASE_PATH=" "$ENV_FILE" 2>/dev/null | head -1 | sed 's/^[^=]*=//' | tr -d '"' | tr -d "'" || true)

# Suporte a caminho relativo (resolve a partir do diretório do .env)
if [[ "$DB_PATH" != /* ]]; then
  DB_PATH="/var/www/atelie/app_dev/backend/${DB_PATH#./}"
fi

[ -n "$DB_PATH" ] || die "DATABASE_PATH não encontrado no .env"
[ -f "$DB_PATH" ] || die "Arquivo de banco não encontrado: $DB_PATH"

log "Banco: $DB_PATH"

# Criar diretório de backup local
mkdir -p "$BACKUP_DIR"

LOCAL_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"

# ── Dump SQLite + compressão ─────────────────────────────────
log "Gerando backup: $LOCAL_FILE"

if command -v sqlite3 >/dev/null 2>&1; then
  # Backup quente via sqlite3 (seguro com banco em uso)
  TEMP_DB="${BACKUP_DIR}/temp_backup_${TIMESTAMP}.db"
  sqlite3 "$DB_PATH" ".backup '${TEMP_DB}'"
  gzip -c "$TEMP_DB" > "$LOCAL_FILE"
  rm -f "$TEMP_DB"
else
  # Fallback: cópia direta do arquivo
  gzip -c "$DB_PATH" > "$LOCAL_FILE"
fi

# Verificar se o arquivo gerado tem conteúdo
FILE_SIZE=$(stat -c%s "$LOCAL_FILE" 2>/dev/null || stat -f%z "$LOCAL_FILE")
if [ "$FILE_SIZE" -lt 100 ]; then
  die "Arquivo de backup suspeito (tamanho ${FILE_SIZE} bytes). Abortando upload."
fi

log "Backup gerado: ${FILE_SIZE} bytes"

# ── Upload para Google Drive ─────────────────────────────────
log "Enviando para ${RCLONE_REMOTE}:${RCLONE_FOLDER}/ ..."

rclone copy \
  "$LOCAL_FILE" \
  "${RCLONE_REMOTE}:${RCLONE_FOLDER}/" \
  --transfers=1 \
  --retries=3 \
  --log-level=INFO \
  --log-file="$LOG_FILE"

log "Upload concluído: ${BACKUP_FILENAME}"

# ── Limpeza local (mantém últimos 7 arquivos) ─────────────────
log "Limpando backups locais antigos (mantendo 7 mais recentes)..."
ls -t "${BACKUP_DIR}"/atelie_db_*.db.gz 2>/dev/null \
  | tail -n +8 \
  | xargs -r rm -v >> "$LOG_FILE" 2>&1

# ── Limpeza no Google Drive (retenção de 30 dias) ────────────
log "Removendo backups com mais de ${RETENTION_DAYS} dias no Drive..."

rclone delete \
  "${RCLONE_REMOTE}:${RCLONE_FOLDER}/" \
  --min-age="${RETENTION_DAYS}d" \
  --include="atelie_db_*.db.gz" \
  --log-level=INFO \
  --log-file="$LOG_FILE"

log "===== Backup concluído com sucesso ====="
log ""
