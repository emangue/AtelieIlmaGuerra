#!/bin/bash
# Inicia backend e frontend - Ateliê Ilma Guerra
# Tenta portas alternativas automaticamente se a preferida estiver ocupada
set -e
cd "$(dirname "$0")/.."

# Encontra a primeira porta livre a partir de start_port
find_free_port() {
  local start=$1
  local max_tries=${2:-10}
  local port=$start
  local i=0
  while [ $i -lt $max_tries ]; do
    if ! lsof -i :$port >/dev/null 2>&1; then
      echo $port
      return
    fi
    port=$((port + 1))
    i=$((i + 1))
  done
  echo ""  # nenhuma livre
}

echo "🔍 Verificando portas disponíveis..."

BACKEND_PORT=$(find_free_port 8000)
FRONTEND_PORT=$(find_free_port 3001)

if [ -z "$BACKEND_PORT" ]; then
  echo "❌ Nenhuma porta livre para backend (8000-8009)"
  exit 1
fi
if [ -z "$FRONTEND_PORT" ]; then
  echo "❌ Nenhuma porta livre para frontend (3001-3010)"
  exit 1
fi

if [ "$BACKEND_PORT" != "8000" ] || [ "$FRONTEND_PORT" != "3001" ]; then
  echo "   Backend: $BACKEND_PORT (8000 ocupada)"
  echo "   Frontend: $FRONTEND_PORT (3001 ocupada)"
fi

echo ""
echo "🚀 Iniciando Ateliê Ilma Guerra..."
mkdir -p logs

# Backend
echo "▶ Backend (porta $BACKEND_PORT)..."
cd app_dev/backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  python init_db.py
else
  source venv/bin/activate
fi
PORT=$BACKEND_PORT nohup python run.py > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ../..

# Frontend
echo "▶ Frontend (porta $FRONTEND_PORT)..."
cd app_dev/frontend
# Define backend URL para proxy (rewrites no next.config)
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:$BACKEND_PORT" > .env.local
if [ ! -d "node_modules" ]; then
  npm install
fi
NEXT_PUBLIC_BACKEND_URL="http://localhost:$BACKEND_PORT" nohup npx next dev -p $FRONTEND_PORT > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# Salva PIDs e portas para quick_stop
echo "$BACKEND_PID" > .atelie-backend.pid
echo "$FRONTEND_PID" >> .atelie-backend.pid
echo "$BACKEND_PORT" > .atelie-ports
echo "$FRONTEND_PORT" >> .atelie-ports

echo ""
echo "✅ Servidores iniciados!"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   API Docs: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "Login: admin@atelie.com / admin123"
echo ""
echo "Para parar: bash scripts/quick_stop.sh"
echo "   ou: kill $BACKEND_PID $FRONTEND_PID"
