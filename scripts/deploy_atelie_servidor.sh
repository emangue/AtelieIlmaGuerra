#!/bin/bash
# =============================================================================
# Deploy Ateliê no servidor — integra ao Nginx Docker do FinUp
# =============================================================================
# Execute NO SERVIDOR, com o projeto AtelieIlmaGuerra e ProjetoFinancasV5 presentes.
#
# Uso: bash scripts/deploy_atelie_servidor.sh
#
# Variáveis (ajuste se necessário):
#   FINUP_DIR  — pasta do ProjetoFinancasV5 no servidor
#   ATELIE_DIR — pasta do AtelieIlmaGuerra no servidor
# =============================================================================

set -e

# Ajuste os caminhos conforme seu servidor
FINUP_DIR="${FINUP_DIR:-/var/www/ProjetoFinancasV5}"
ATELIE_DIR="${ATELIE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

echo "=== Deploy Ateliê (integração Nginx Docker) ==="
echo "FinUp:  $FINUP_DIR"
echo "Ateliê: $ATELIE_DIR"
echo ""

# 1. Copiar config do Ateliê para o Nginx do FinUp
echo "1. Copiando atelie-gestao-nginx.conf para Nginx do FinUp..."
cp "$ATELIE_DIR/scripts/atelie-gestao-nginx.conf" "$FINUP_DIR/nginx/conf.d/atelie-gestao.conf"
echo "   OK"

# 2. Copiar certificados do Ateliê (sistema → certbot do Docker)
echo "2. Copiando certificados do Ateliê para certbot do FinUp..."
mkdir -p "$FINUP_DIR/certbot/conf/live" "$FINUP_DIR/certbot/conf/archive"
sudo cp -rL /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br "$FINUP_DIR/certbot/conf/live/" 2>/dev/null || {
    echo "   AVISO: Certificados não encontrados em /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br"
    echo "   Execute antes: sudo certbot certonly --webroot -w /var/www/html -d gestao.atelieilmaguerra.com.br"
}
sudo chown -R "$(whoami):$(whoami)" "$FINUP_DIR/certbot/conf/" 2>/dev/null || true
echo "   OK"

# 3. Verificar extra_hosts no docker-compose
echo "3. Verificando extra_hosts no docker-compose..."
if grep -q "host.docker.internal" "$FINUP_DIR/docker-compose.prod.yml" 2>/dev/null; then
    echo "   extra_hosts já presente"
else
    echo "   AVISO: Adicione manualmente ao serviço nginx em docker-compose.prod.yml:"
    echo ""
    echo "   extra_hosts:"
    echo '     - "host.docker.internal:host-gateway"'
    echo ""
    echo "   (entre 'networks:' e 'ports:' do nginx)"
    echo "   Depois: docker compose up -d nginx"
fi

# 4. Reiniciar o Nginx do Docker
echo "4. Recarregando Nginx do Docker..."
cd "$FINUP_DIR"
docker compose -f docker-compose.prod.yml --env-file .env.prod exec nginx nginx -t 2>/dev/null && \
    docker compose -f docker-compose.prod.yml --env-file .env.prod exec nginx nginx -s reload 2>/dev/null || {
    echo "   Recarregar falhou. Tentando restart do container..."
    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d nginx
}

echo ""
echo "=== Concluído ==="
echo "Teste: curl -sI https://gestao.atelieilmaguerra.com.br | head -5"
