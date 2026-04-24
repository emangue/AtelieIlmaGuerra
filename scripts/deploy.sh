#!/bin/bash
# =============================================================================
# Deploy Ateliê Ilma Guerra → gestao.atelieilmaguerra.com.br
# =============================================================================
# Uso:
#   ./scripts/deploy.sh              # Usa VM_HOST do config.sh (minha-vps-hostinger)
#   ./scripts/deploy.sh 148.230.78.91
#   VM_HOST=outro-alias ./scripts/deploy.sh
#
# Garante: pasta isolada, sem arquivos sensíveis (.deployignore)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_IGNORE="$PROJECT_DIR/.deployignore"

# Usar VM_HOST do config ou IP como argumento
if [ -n "$1" ] && [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  VM_TARGET="root@$1"
  echo "Usando IP: $1"
elif [ -f "$SCRIPT_DIR/deploy/config.sh" ]; then
  source "$SCRIPT_DIR/deploy/config.sh"
  VM_TARGET="root@${VM_HOST}"
  echo "Usando alias SSH: $VM_HOST"
else
  VM_TARGET="${VM_HOST:+root@$VM_HOST}"
  if [ -z "$VM_TARGET" ]; then
    echo "Uso: ./scripts/deploy.sh [IP_DO_SERVIDOR]"
    echo "   ou ./scripts/deploy.sh (com VM_HOST em scripts/deploy/config.sh)"
    echo ""
    echo "Exemplo: ./scripts/deploy.sh 148.230.78.91"
    exit 1
  fi
  echo "Usando VM_HOST: $VM_HOST"
fi

ATELIE_PATH="${ATELIE_PATH:-/var/www/atelie}"

echo "📁 Projeto: $PROJECT_DIR"
echo "🖥️  Destino: $VM_TARGET:$ATELIE_PATH/"
echo "🔒 Exclusões: .deployignore"
echo ""

# Verificar .deployignore
if [ ! -f "$DEPLOY_IGNORE" ]; then
  echo "⚠️  .deployignore não encontrado. Usando exclusões padrão."
  RSYNC_EXCLUDES=(
    --exclude 'node_modules'
    --exclude '.next'
    --exclude 'venv'
    --exclude '.env'
    --exclude '.env.*'
    --exclude '*.db'
    --exclude 'uploads'
    --exclude '.git'
    --exclude '*.xlsx'
    --exclude '*.pdf'
    --exclude 'database'
  )
else
  RSYNC_EXCLUDES=(--exclude-from="$DEPLOY_IGNORE")
fi

# 1. Build frontend
echo "🔨 Build do frontend..."
cd "$PROJECT_DIR/app_dev/frontend"
npm run build
echo "✅ Build concluído"
echo ""

# 2. Transferir via rsync
echo "📤 Transferindo para $VM_TARGET:$ATELIE_PATH/ ..."
rsync -avz --progress "${RSYNC_EXCLUDES[@]}" \
  "$PROJECT_DIR/" \
  "$VM_TARGET:$ATELIE_PATH/"

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "⚠️  PRÓXIMOS PASSOS:"
echo "   1. SSH na VM: ssh $VM_TARGET"
echo "   2. Executar: cd $ATELIE_PATH && bash scripts/deploy/pos_deploy_vm.sh"
echo "   3. Se 1ª vez: criar .env e .env.production (copiar dos .example)"
echo "   4. Configurar Nginx: ver docs/deploy/GUIA_DEPLOY_GESTAO.md"
echo "   5. Validar/reparar: ./scripts/validar_e_reparar_vm.sh"
echo ""
