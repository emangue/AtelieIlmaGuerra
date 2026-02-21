#!/bin/bash
# Inicia backend e frontend - Ateliê Ilma Guerra
set -e
cd "$(dirname "$0")/.."

echo "🚀 Iniciando Ateliê Ilma Guerra..."

# Backend
echo "▶ Backend (porta 8000)..."
cd app_dev/backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  python init_db.py
else
  source venv/bin/activate
fi
python run.py &
BACKEND_PID=$!
cd ../..

# Frontend
echo "▶ Frontend (porta 3000)..."
cd app_dev/frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ../..

echo ""
echo "✅ Servidores iniciados!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Login: admin@atelie.com / admin123"
echo ""
echo "PIDs: Backend=$BACKEND_PID Frontend=$FRONTEND_PID"
echo "Para parar: kill $BACKEND_PID $FRONTEND_PID"
