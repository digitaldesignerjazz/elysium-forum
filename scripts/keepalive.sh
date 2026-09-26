#!/usr/bin/env bash
# Restart API+tunnel if dead; push config.js to GitHub when URL changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/.runtime"
mkdir -p "$LOG_DIR"
PORT="${PORT:-8787}"
export PATH="/tmp/node-v22.19.0-linux-x64/bin:${PATH:-}"

need_restart=0
if [[ ! -f "$LOG_DIR/api.pid" ]] || ! kill -0 "$(cat "$LOG_DIR/api.pid")" 2>/dev/null; then
  need_restart=1
fi
if [[ ! -f "$LOG_DIR/tunnel.pid" ]] || ! kill -0 "$(cat "$LOG_DIR/tunnel.pid")" 2>/dev/null; then
  need_restart=1
fi
if ! curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  need_restart=1
fi

if [[ "$need_restart" -eq 1 ]]; then
  echo "[keepalive] restarting $(date -Iseconds)"
  "$ROOT/scripts/start-live.sh" | tee -a "$LOG_DIR/keepalive.log"
fi

# Push config if changed vs remote (best-effort)
cd "$ROOT"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --quiet -- public/config.js 2>/dev/null; then
    git add public/config.js data/store.json 2>/dev/null || git add public/config.js
    git -c user.email="elysium-bot@users.noreply.github.com" -c user.name="elysium-bot" \
      commit -m "chore: update live api url" || true
    git push origin main 2>/dev/null || true
  fi
fi
