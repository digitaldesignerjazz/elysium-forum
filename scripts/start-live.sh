#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/tmp/node-v22.19.0-linux-x64/bin:/usr/local/bin:/usr/bin:${PATH:-}"
PORT="${PORT:-8787}"
LOG_DIR="$ROOT/.runtime"
mkdir -p "$LOG_DIR"

kill_pidfile() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local p; p="$(cat "$f" || true)"
    if [[ -n "${p:-}" ]] && kill -0 "$p" 2>/dev/null; then
      kill "$p" 2>/dev/null || true
      sleep 0.3
      kill -9 "$p" 2>/dev/null || true
    fi
    rm -f "$f"
  fi
}

kill_pidfile "$LOG_DIR/api.pid"
kill_pidfile "$LOG_DIR/bore.pid"

echo "[start] api :$PORT"
: >"$LOG_DIR/api.log"
nohup env PATH="$PATH" node "$ROOT/server/index.js" >>"$LOG_DIR/api.log" 2>&1 &
echo $! >"$LOG_DIR/api.pid"
for i in $(seq 1 60); do
  curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null && break
  kill -0 "$(cat "$LOG_DIR/api.pid")" 2>/dev/null || { cat "$LOG_DIR/api.log"; exit 1; }
  sleep 0.4
done
curl -sf "http://127.0.0.1:${PORT}/api/health"; echo

echo "[start] bore tunnel"
: >"$LOG_DIR/bore.log"
nohup bore local "$PORT" --to bore.pub >>"$LOG_DIR/bore.log" 2>&1 &
echo $! >"$LOG_DIR/bore.pid"
LIVE=""
for i in $(seq 1 40); do
  LIVE="$(rg -o 'bore\.pub:[0-9]+' "$LOG_DIR/bore.log" 2>/dev/null | head -1 || true)"
  if [[ -n "$LIVE" ]]; then LIVE="http://$LIVE"; break; fi
  sleep 0.3
done
if [[ -z "$LIVE" ]]; then echo "no bore url"; cat "$LOG_DIR/bore.log"; exit 1; fi
echo "[start] live $LIVE"
NOW="$(date -Iseconds)"
cat > "$ROOT/public/config.js" <<CFG
/* auto-updated by scripts/start-live.sh */
window.ELYSIUM_CONFIG = {
  apiBase: "${LIVE}",
  updatedAt: "${NOW}"
};
CFG
echo "$LIVE" > "$LOG_DIR/live-url.txt"
echo "$LIVE"
