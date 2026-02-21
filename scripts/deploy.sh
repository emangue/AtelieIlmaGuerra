#!/bin/bash
# Deploy Ateliê Ilma Guerra → gestao.atelieilmaguerra.com.br
# Garante: pasta isolada, sem arquivos sensíveis
# Uso: ./scripts/deploy.sh [IP_DO_SERVIDOR]
#
# Exemplo: ./scripts/deploy.sh 148.230.78.91

set -e

IP="${1:-}"
if [ -z "$IP" ]; then
  echo "Uso: ./scripts/deploy.sh IP_DO_SERVIDOR"
  echo "Exemplo: ./scripts/deploy.sh 148.230.78.91"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_IGNORE="$PROJECT_DIR/.deployignore"

echo "📁 Projeto: $PROJECT_DIR"
echo "🖥️  Servidor: $IP"
echo "📂 Destino: /var/www/atelie/ (pasta isolada)"
echo "🔒 Exclusões: .deployignore (sem .env, *.db, uploads, etc.)"
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

# 2. Transferir via rsync (exclusões do .deployignore)
echo "📤 Transferindo para root@$IP:/var/www/atelie/ ..."
rsync -avz --progress "${RSYNC_EXCLUDES[@]}" \
  "$PROJECT_DIR/" \
  "root@$IP:/var/www/atelie/"

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "⚠️  IMPORTANTE - No servidor:"
echo "   1. Criar .env no backend (copiar de .env.example)"
echo "   2. Criar .env.production no frontend (copiar de .env.production.example)"
echo "   3. NUNCA commitar ou transferir: .env, *.db, uploads/, planilhas, contratos"
echo ""
echo "📋 Comandos no servidor (SSH root@$IP):"
echo "   mkdir -p /var/www/atelie/app_dev/backend/database"
echo "   cd /var/www/atelie/app_dev/backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
echo "   cd /var/www/atelie/app_dev/frontend && npm ci && npm run build"
echo "   # Criar .env e .env.production (copiar dos .example)"
echo "   sudo systemctl restart atelie-backend atelie-frontend"
echo ""
