#!/bin/bash
# Para backend e frontend - Ateliê Ilma Guerra
set -e
cd "$(dirname "$0")/.."

echo "🛑 Parando Ateliê Ilma Guerra..."

# Tenta matar por PID (salvos pelo quick_start)
if [ -f .atelie-backend.pid ]; then
  while read pid; do
    if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
      echo "   Parando PID $pid..."
      kill $pid 2>/dev/null || true
    fi
  done < .atelie-backend.pid
  rm -f .atelie-backend.pid .atelie-ports
fi

# Fallback: mata processos nas portas usadas (8000-8009 backend, 3001-3010 frontend)
for port in 8000 8001 8002 8003 8004 8005 8006 8007 8008 8009 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "   Parando porta $port (PID $pid)..."
    kill $pid 2>/dev/null || true
  fi
done

echo "✅ Servidores parados."
