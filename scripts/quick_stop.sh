#!/bin/bash
# Para backend e frontend - Ateliê Ilma Guerra
set -e
cd "$(dirname "$0")/.."

echo "🛑 Parando Ateliê Ilma Guerra..."

# Mata processos nas portas 8000 (backend) e 3000 (frontend)
for port in 8000 3000; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "   Parando processo na porta $port (PID $pid)..."
    kill $pid 2>/dev/null || true
  fi
done

echo "✅ Servidores parados."
