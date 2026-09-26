#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/.runtime"
mkdir -p "$LOG_DIR"
PORT="${PORT:-8787}"
export PATH="/tmp/node-v22.19.0-linux-x64/bin:/usr/local/bin:/usr/bin:${PATH:-}"

need=0
if [[ ! -f "$LOG_DIR/api.pid" ]] || ! kill -0 "$(cat "$LOG_DIR/api.pid")" 2>/dev/null; then need=1; fi
if [[ ! -f "$LOG_DIR/bore.pid" ]] || ! kill -0 "$(cat "$LOG_DIR/bore.pid")" 2>/dev/null; then need=1; fi
if ! curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then need=1; fi
LIVE_FILE="$LOG_DIR/live-url.txt"
if [[ -f "$LIVE_FILE" ]]; then
  if ! curl -sf "$(cat "$LIVE_FILE")/api/health" >/dev/null 2>&1; then need=1; fi
fi
if [[ "$need" -eq 1 ]]; then
  echo "[keepalive] restart $(date -Iseconds)" | tee -a "$LOG_DIR/keepalive.log"
  "$ROOT/scripts/start-live.sh" | tee -a "$LOG_DIR/keepalive.log"
fi

cd "$ROOT"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add public/config.js data/store.json 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git -c user.email="elysium-bot@users.noreply.github.com" -c user.name="elysium-bot" \
      commit -m "chore: sync live url / store" || true
    git push origin main 2>/dev/null || true
  fi
fi
