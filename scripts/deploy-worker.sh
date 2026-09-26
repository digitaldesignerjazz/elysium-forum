#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/tmp/node-v22.19.0-linux-x64/bin:${PATH:-}"
if ! command -v node >/dev/null || [[ "$(node -v 2>/dev/null || true)" != v22* ]]; then
  if [[ ! -x /tmp/node-v22.19.0-linux-x64/bin/node ]]; then
    curl -fsSL -o /tmp/node22.tar.xz https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz
    tar -xf /tmp/node22.tar.xz -C /tmp
  fi
  export PATH="/tmp/node-v22.19.0-linux-x64/bin:$PATH"
fi
cd "$ROOT/worker"
echo "[deploy] wrangler deploy --temporary (or omit --temporary after wrangler login / claim)"
npx --yes wrangler@4 deploy --temporary | tee "$ROOT/.runtime/wrangler-deploy.log"
# Extract URL
LIVE=$(grep -Eo 'https://[a-z0-9.-]+\.workers\.dev' "$ROOT/.runtime/wrangler-deploy.log" | head -1 || true)
CLAIM=$(grep -Eo 'https://dash\.cloudflare\.com/claim-preview\?claimToken=[A-Za-z0-9_-]+' "$ROOT/.runtime/wrangler-deploy.log" | head -1 || true)
NOW=$(date -Iseconds)
if [[ -n "${LIVE:-}" ]]; then
  echo "$LIVE" > "$ROOT/.runtime/live-url.txt"
  cat > "$ROOT/docs/config.js" << CFG
/* auto-updated — github pages → workers api */
window.ELYSIUM_CONFIG = {
  apiBase: "$LIVE",
  updatedAt: "$NOW",
  note: "pages mirror; shared state on cloudflare workers+kv"
};
CFG
  cp "$ROOT/docs/config.js" "$ROOT/config.js"
  cat > "$ROOT/public/config.js" << CFG
/* auto-updated — cloudflare workers (same-origin) */
window.ELYSIUM_CONFIG = {
  apiBase: "",
  updatedAt: "$NOW",
  note: "same-origin on $LIVE"
};
CFG
fi
[[ -n "${CLAIM:-}" ]] && echo "$CLAIM" > "$ROOT/.runtime/claim-url.txt"
echo "[deploy] live=${LIVE:-unknown}"
echo "[deploy] claim=${CLAIM:-none (already permanent account?)}"
