#!/usr/bin/env bash
# Validador somente leitura para executar do Mac antes e depois de cada ajuste na VM.
# Uso local: bash scripts/validar_vm_pos_ajuste.sh [alias-ssh]

set -uo pipefail

VM_TARGET="${1:-minha-vps-hostinger}"
FAILURES=0
WARNINGS=0

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
warn() { printf 'WARN  %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }

http_expect() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local code
  code=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)
  if [[ "$code" =~ ^($expected)$ ]]; then
    pass "$name HTTP $code"
  else
    fail "$name retornou HTTP ${code:-000}; esperado $expected"
  fi
}

tls_check() {
  local host="$1"
  local expiry
  expiry=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2-)
  if [ -z "$expiry" ]; then
    fail "$host não apresentou certificado legível"
    return
  fi
  local expiry_epoch now_epoch days
  expiry_epoch=$(date -j -f '%b %e %T %Y %Z' "$expiry" '+%s' 2>/dev/null \
    || date -d "$expiry" '+%s' 2>/dev/null \
    || true)
  now_epoch=$(date '+%s')
  if [ -z "$expiry_epoch" ]; then
    warn "$host certificado expira em $expiry; não foi possível calcular dias"
    return
  fi
  days=$(( (expiry_epoch - now_epoch) / 86400 ))
  if [ "$days" -lt 0 ]; then
    fail "$host certificado expirado há $((-days)) dias"
  elif [ "$days" -lt 21 ]; then
    fail "$host certificado expira em $days dias"
  elif [ "$days" -lt 45 ]; then
    warn "$host certificado expira em $days dias"
  else
    pass "$host certificado válido por $days dias"
  fi
}

printf '=== VALIDAÇÃO VM %s ===\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
printf 'Alvo: %s\n\n' "$VM_TARGET"

echo '--- Endpoints públicos ---'
http_expect 'Ateliê login' 'https://gestao.atelieilmaguerra.com.br/auth/login' '200'
http_expect 'Ateliê health' 'https://gestao.atelieilmaguerra.com.br/api/health' '200'
http_expect 'Atendimento login' 'https://atendimento.atelieilmaguerra.com.br/login' '200|307'
http_expect 'Atendimento health' 'https://atendimento.atelieilmaguerra.com.br/api/health' '200'
http_expect 'FinUp admin' 'https://admin.meufinup.com.br/' '200|301|302|307|308'

echo
echo '--- TLS público ---'
tls_check 'gestao.atelieilmaguerra.com.br'
tls_check 'atendimento.atelieilmaguerra.com.br'
tls_check 'admin.meufinup.com.br'
tls_check 'meufinup.com.br'

echo
echo '--- Validação interna somente leitura ---'
REMOTE_OUTPUT=$(ssh "$VM_TARGET" 'bash -s' <<'REMOTE'
set -uo pipefail
failures=0
warnings=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
warn() { printf 'WARN  %s\n' "$1"; warnings=$((warnings + 1)); }

for unit in atelie-backend atelie-frontend atelie-atendimento-backend atelie-atendimento-frontend fail2ban auditd docker; do
  if systemctl is-active --quiet "$unit"; then
    pass "service $unit ativo"
  else
    fail "service $unit inativo"
  fi
done

for endpoint in \
  'Ateliê backend|http://127.0.0.1:8001/api/health|200' \
  'Ateliê frontend|http://127.0.0.1:3004/auth/login|200' \
  'Atendimento backend|http://127.0.0.1:8002/api/health|200' \
  'Atendimento frontend|http://127.0.0.1:3005/login|200,307'; do
  IFS='|' read -r name url expected <<< "$endpoint"
  code=$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)
  if [[ ",$expected," == *",$code,"* ]]; then
    pass "$name local HTTP $code"
  else
    fail "$name local HTTP ${code:-000}; esperado $expected"
  fi
done

if docker exec infra_nginx nginx -t >/dev/null 2>&1; then
  pass 'configuração do proxy Docker válida'
else
  fail 'configuração do proxy Docker inválida'
fi

docker_health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' infra_nginx 2>/dev/null || true)
if [ "$docker_health" = 'healthy' ]; then
  pass 'infra_nginx healthy'
else
  warn "infra_nginx health=$docker_health"
fi

db='/var/www/atelie/app_dev/backend/database/atelie.db'
if command -v sqlite3 >/dev/null 2>&1 && [ -f "$db" ]; then
  result=$(sqlite3 "file:$db?mode=ro" 'PRAGMA quick_check;' 2>/dev/null || true)
  if [ "$result" = 'ok' ]; then
    pass 'SQLite Ateliê quick_check=ok'
  else
    fail "SQLite Ateliê quick_check=${result:-erro}"
  fi
else
  warn 'SQLite ou banco do Ateliê indisponível para quick_check'
fi

backup=$(ls -1t /var/backups/atelie/*.gz 2>/dev/null | head -1 || true)
if [ -n "$backup" ] && gzip -t "$backup" 2>/dev/null; then
  age=$(( ($(date +%s) - $(stat -c %Y "$backup")) / 3600 ))
  if [ "$age" -le 30 ]; then
    pass "backup Ateliê íntegro e recente (${age}h)"
  else
    fail "backup Ateliê tem ${age}h"
  fi
else
  fail 'backup Ateliê ausente ou corrompido'
fi

disk=$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')
if [ "${disk:-100}" -lt 80 ]; then
  pass "disco raiz ${disk}% utilizado"
else
  fail "disco raiz ${disk}% utilizado"
fi

if git -C /var/www/atelie diff --quiet && [ -z "$(git -C /var/www/atelie ls-files --others --exclude-standard | head -1)" ]; then
  pass 'Git Ateliê limpo'
else
  warn "Git Ateliê possui alterações; branch=$(git -C /var/www/atelie branch --show-current) commit=$(git -C /var/www/atelie rev-parse --short HEAD)"
fi

new_errors=$(journalctl -p 0..3 --since '15 minutes ago' --no-pager 2>/dev/null \
  | grep -Ev 'certbot.service|Failed to start certbot' | wc -l)
if [ "$new_errors" -eq 0 ]; then
  pass 'sem novos erros críticos no journal nos últimos 15 minutos'
else
  warn "$new_errors linhas críticas no journal nos últimos 15 minutos"
fi

printf 'REMOTE_SUMMARY failures=%s warnings=%s\n' "$failures" "$warnings"
REMOTE
)
SSH_STATUS=$?
printf '%s\n' "$REMOTE_OUTPUT"

if [ "$SSH_STATUS" -ne 0 ]; then
  fail "SSH/validação remota terminou com status $SSH_STATUS"
else
  REMOTE_FAILURES=$(printf '%s\n' "$REMOTE_OUTPUT" | sed -n 's/.*REMOTE_SUMMARY failures=\([0-9][0-9]*\).*/\1/p' | tail -1)
  REMOTE_WARNINGS=$(printf '%s\n' "$REMOTE_OUTPUT" | sed -n 's/.*warnings=\([0-9][0-9]*\).*/\1/p' | tail -1)
  FAILURES=$((FAILURES + ${REMOTE_FAILURES:-1}))
  WARNINGS=$((WARNINGS + ${REMOTE_WARNINGS:-0}))
fi

echo
printf 'SUMMARY failures=%s warnings=%s\n' "$FAILURES" "$WARNINGS"
if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
