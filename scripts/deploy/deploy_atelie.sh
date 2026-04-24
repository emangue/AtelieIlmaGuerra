#!/bin/bash
# =============================================================================
# Deploy Ateliê — integra ao Nginx Docker do FinUp (via SSH)
# =============================================================================
# Usa o mesmo padrão do ProjetoFinancasV5: VM_HOST do ~/.ssh/config (porta 50022)
#
# Uso: ./scripts/deploy/deploy_atelie.sh
#
# Pré-requisito: ~/.ssh/config com alias (ex: minha-vps-hostinger)
#   Host minha-vps-hostinger
#     HostName 148.230.78.91
#     Port 50022
#     User root
#     IdentityFile ~/.ssh/id_rsa_hostinger
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ATELIE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "=== Deploy Ateliê (integração Nginx Docker) ==="
echo "SSH:    $VM_HOST"
echo "Ateliê: $ATELIE_PATH"
echo "FinUp:  $FINUP_PATH"
echo ""

# 1. Enviar config do Nginx para o servidor
echo "1. Enviando atelie-gestao-nginx.conf..."
scp -o ConnectTimeout=15 "$ATELIE_ROOT/scripts/atelie-gestao-nginx.conf" "$VM_HOST:/tmp/atelie-gestao.conf"

# 2. Executar deploy no servidor via SSH
echo "2. Executando integração no servidor..."
ssh -o ConnectTimeout=15 -o ServerAliveInterval=30 "$VM_HOST" "
    set -e
    
    # Copiar config para Nginx do FinUp
    cp /tmp/atelie-gestao.conf $FINUP_PATH/nginx/conf.d/atelie-gestao.conf
    rm -f /tmp/atelie-gestao.conf
    echo '   Config copiado'
    
    # Copiar certificados (sistema → certbot do Docker)
    mkdir -p $FINUP_PATH/certbot/conf/live $FINUP_PATH/certbot/conf/archive
    if [ -d /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br ]; then
        cp -rL /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br $FINUP_PATH/certbot/conf/live/
        chown -R \$(whoami):\$(whoami) $FINUP_PATH/certbot/conf/ 2>/dev/null || true
        echo '   Certificados copiados'
    else
        echo '   AVISO: Certificados não encontrados em /etc/letsencrypt/live/gestao.atelieilmaguerra.com.br'
    fi
    
    # Recarregar Nginx do Docker
    cd $FINUP_PATH
    if docker compose -f docker-compose.prod.yml --env-file .env.prod exec nginx nginx -t 2>/dev/null; then
        docker compose -f docker-compose.prod.yml --env-file .env.prod exec nginx nginx -s reload 2>/dev/null || \
        docker compose -f docker-compose.prod.yml --env-file .env.prod up -d nginx
        echo '   Nginx recarregado'
    else
        echo '   AVISO: docker compose exec falhou. Verifique se o container nginx está rodando.'
    fi
" || { echo "❌ Falha SSH"; exit 1; }

echo ""
echo "=== Concluído ==="
echo "Teste: curl -sI https://gestao.atelieilmaguerra.com.br | head -5"
echo ""
echo "Se o site não responder, verifique:"
echo "  - extra_hosts no docker-compose.prod.yml do FinUp (host.docker.internal:host-gateway)"
echo "  - Backend e frontend do Ateliê rodando (portas 8001 e 3004)"