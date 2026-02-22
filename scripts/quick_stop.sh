#!/bin/bash
# Para backend e frontend - Ateliê Ilma Guerra
# ⚠️  IMPORTANTE: mata APENAS os processos deste app (via PID file)
#     NUNCA mata por faixa de portas — o servidor pode ter outros apps nessas portas
set -e
cd "$(dirname "$0")/.."

echo "🛑 Parando Ateliê Ilma Guerra..."

if [ ! -f .atelie-backend.pid ]; then
  echo "⚠️  Nenhum PID salvo (.atelie-backend.pid não encontrado)."
  echo "   Os servidores já estavam parados ou foram iniciados de outra forma."
  echo "   Para encontrar os processos manualmente: grep 'Listening on\|running on' logs/backend.log logs/frontend.log 2>/dev/null | tail -5"
  exit 0
fi

# Mata APENAS os PIDs que este app registrou — nunca por faixa de portas
STOPPED=0
while read pid; do
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "   Parando PID $pid..."
    kill "$pid" 2>/dev/null || true
    STOPPED=$((STOPPED + 1))
  fi
done < .atelie-backend.pid

rm -f .atelie-backend.pid .atelie-ports

if [ $STOPPED -gt 0 ]; then
  echo "✅ $STOPPED processo(s) parado(s)."
else
  echo "⚠️  PIDs do arquivo já não estavam rodando."
fi
