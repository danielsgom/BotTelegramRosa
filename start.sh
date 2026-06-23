#!/bin/bash
# start.sh — Arranca el bot matando cualquier instancia previa

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=$(grep -E '^PORT=' "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ')
PORT=${PORT:-9003}

echo "Matando procesos anteriores..."
pkill -9 -f "src/backend/app.py" 2>/dev/null
sleep 2
lsof -t -i:"${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

echo "Limpio. Esperando 35s para que Telegram cierre conexiones..."
sleep 35

echo "Arrancando en puerto $PORT..."
cd "$SCRIPT_DIR"
exec python3 -u src/backend/app.py
