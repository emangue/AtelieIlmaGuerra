#!/bin/bash
# Verifica se backend e frontend do Ateliê estão rodando
# Execute no servidor: bash scripts/verificar_servicos.sh

echo "=== Verificação Ateliê Ilma Guerra ==="
echo ""

# Portas esperadas (Nginx: frontend 3004, backend 8001)
BACKEND_PORT=8001
FRONTEND_PORT=3004

check_port() {
  local port=$1
  local name=$2
  if ss -tlnp 2>/dev/null | grep -q ":$port "; then
    echo "✅ $name (porta $port): RODANDO"
    return 0
  else
    echo "❌ $name (porta $port): NÃO ESTÁ RODANDO"
    return 1
  fi
}

check_port $BACKEND_PORT "Backend"
BACKEND_OK=$?
check_port $FRONTEND_PORT "Frontend"
FRONTEND_OK=$?

echo ""
if [ $BACKEND_OK -eq 0 ]; then
  echo "Testando API health..."
  curl -s -o /dev/null -w "   /api/health: HTTP %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/api/health || true
fi

if [ $FRONTEND_OK -eq 0 ]; then
  echo "Testando frontend..."
  curl -s -o /dev/null -w "   /: HTTP %{http_code}\n" http://127.0.0.1:$FRONTEND_PORT/ || true
fi

echo ""
if [ $BACKEND_OK -ne 0 ] || [ $FRONTEND_OK -ne 0 ]; then
  echo "⚠️  Para subir os serviços:"
  echo "   sudo systemctl restart atelie-backend atelie-frontend"
  echo ""
  echo "   Ou veja: docs/deploy/RECUPERAR_SITE_502.md"
  exit 1
fi

echo "✅ Todos os serviços estão rodando."
exit 0
