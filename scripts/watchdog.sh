#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
while true; do
  "$ROOT/scripts/keepalive.sh" >>"$ROOT/.runtime/watchdog.log" 2>&1 || true
  sleep 60
done
