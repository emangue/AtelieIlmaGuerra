#!/usr/bin/env bash
# Renova o certificado do Atendimento, mantido no diretório montado pelo
# proxy Docker. O Certbot padrão do host usa /etc/letsencrypt e não enxerga
# esta linhagem separada.

set -euo pipefail

CONFIG_DIR="/opt/finup/certbot/conf"
WORK_DIR="/opt/finup/certbot/work"
LOGS_DIR="/opt/finup/certbot/log"
CERT_NAME="atendimento.atelieilmaguerra.com.br"
CERT_PATH="$CONFIG_DIR/live/$CERT_NAME/fullchain.pem"
LOCK_FILE="/run/lock/atelie-certbot-atendimento.lock"

mkdir -p "$WORK_DIR" "$LOGS_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) renovação já está em execução; encerrando"
  exit 0
fi

if [ ! -f "$CERT_PATH" ]; then
  echo "Certificado não encontrado: $CERT_PATH" >&2
  exit 1
fi

before_sha=$(sha256sum "$CERT_PATH" | awk '{print $1}')

certbot renew \
  --cert-name "$CERT_NAME" \
  --quiet \
  --no-random-sleep-on-renew \
  --config-dir "$CONFIG_DIR" \
  --work-dir "$WORK_DIR" \
  --logs-dir "$LOGS_DIR"

after_sha=$(sha256sum "$CERT_PATH" | awk '{print $1}')

if [ "$before_sha" = "$after_sha" ]; then
  echo "$(date -Is) certificado ainda não estava no período de renovação"
  exit 0
fi

docker exec infra_nginx nginx -t
docker exec infra_nginx nginx -s reload
echo "$(date -Is) certificado renovado e proxy recarregado"

