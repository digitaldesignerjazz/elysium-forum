#!/usr/bin/env bash
# Start API + cloudflared quick tunnel; update public/config.js with live URL; optional gh push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/tmp/node-v22.19.0-linux-x64/bin:${PATH:-}"
PORT="${PORT:-8787}"
LOG_DIR="$ROOT/.runtime"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/api.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"
PID_API="$LOG_DIR/api.pid"
PID_TUNNEL="$LOG_DIR/tunnel.pid"

kill_pidfile() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local p
    p="$(cat "$f" || true)"
    if [[ -n "${p:-}" ]] && kill -0 "$p" 2>/dev/null; then
      kill "$p" 2>/dev/null || true
      sleep 0.5
      kill -9 "$p" 2>/dev/null || true
    fi
    rm -f "$f"
  fi
}

# free port
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi
kill_pidfile "$PID_API"
kill_pidfile "$PID_TUNNEL"
pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true

echo "[start] launching api on :$PORT"
nohup node server/index.js >"$API_LOG" 2>&1 &
echo $! >"$PID_API"
sleep 1
if ! kill -0 "$(cat "$PID_API")" 2>/dev/null; then
  echo "[start] api failed:"; tail -50 "$API_LOG"; exit 1
fi

# wait for health
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    break
  fi
  sleep 0.3
done
curl -sf "http://127.0.0.1:${PORT}/api/health" | head -c 200 || { echo "health failed"; tail -40 "$API_LOG"; exit 1; }
echo

echo "[start] launching cloudflared quick tunnel"
: >"$TUNNEL_LOG"
nohup cloudflared tunnel --url "http://127.0.0.1:${PORT}" >"$TUNNEL_LOG" 2>&1 &
echo $! >"$PID_TUNNEL"

LIVE_URL=""
for i in $(seq 1 60); do
  LIVE_URL="$(rg -o 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)"
  if [[ -n "$LIVE_URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$LIVE_URL" ]]; then
  echo "[start] could not parse tunnel url"; tail -40 "$TUNNEL_LOG"; exit 1
fi

echo "[start] live url: $LIVE_URL"

# Update config.js so GitHub Pages (and same bundle) know the API
NOW="$(date -Iseconds)"
cat > "$ROOT/public/config.js" <<CFG
/* auto-updated by scripts/start-live.sh */
window.ELYSIUM_CONFIG = {
  apiBase: "${LIVE_URL}",
  updatedAt: "${NOW}"
};
CFG

# Also write a small runtime marker
cat > "$LOG_DIR/live-url.txt" <<URL
${LIVE_URL}
URL

echo "[start] config.js updated"
echo "$LIVE_URL"
