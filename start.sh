#!/bin/bash
# start.sh — Arranca el backend (FastAPI) + build del frontend React en producción
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/src/frontend-react"
DIST_DIR="$FRONTEND_DIR/dist"

# ── Leer variables del .env ────────────────────────────────────────────────
PORT=$(grep -E '^PORT=' "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ')
PORT=${PORT:-9003}

# ── Matar procesos anteriores ──────────────────────────────────────────────
echo "[1/4] Matando procesos anteriores en puerto $PORT..."
pkill -9 -f "src/backend/main.py" 2>/dev/null || true
pkill -9 -f "src/backend/app.py"  2>/dev/null || true
sleep 2
lsof -t -i:"${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# ── Build del frontend React ───────────────────────────────────────────────
echo "[2/4] Construyendo frontend React..."
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "  → Instalando dependencias npm (primera vez)..."
  npm --prefix "$FRONTEND_DIR" install --silent
fi
npm --prefix "$FRONTEND_DIR" run build
echo "  → Build completado: $DIST_DIR"

# ── Configurar FRONTEND_DIR para que el backend sirva el React build ───────
export FRONTEND_DIR="$DIST_DIR"

# ── Esperar a que Telegram cierre conexiones anteriores ────────────────────
echo "[3/4] Esperando 35s para que Telegram cierre conexiones..."
sleep 35

# ── Arrancar backend ────────────────────────────────────────────────────────
echo "[4/4] Arrancando backend en puerto $PORT (sirviendo frontend desde $DIST_DIR)..."
cd "$SCRIPT_DIR"
exec python3 -u src/backend/main.py
