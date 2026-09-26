#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "bore/cloudflared tunnels are deprecated for this project."
echo "Use Cloudflare Workers instead:"
echo "  $ROOT/scripts/deploy-worker.sh"
if [[ -f "$ROOT/.runtime/live-url.txt" ]]; then
  echo "current live: $(cat "$ROOT/.runtime/live-url.txt")"
fi
if [[ -f "$ROOT/.runtime/claim-url.txt" ]]; then
  echo "claim (if still temporary): $(cat "$ROOT/.runtime/claim-url.txt")"
fi
