#!/usr/bin/env bash
# UI-AUDIT-1: the HUD area measured three times on one build (the user's pass rule for the 1280 build row: all three
# within budget). Writes docs/verification/uiaudit1/hud/run{1,2,3}.json.
#   scripts/remote/run.sh render-UIAUDIT-hud3-<sha7> --detach -- bash scripts/uiaudit1HudThrice.sh
set -u
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite.log 2>&1 &
vite=$!
trap 'kill $vite 2>/dev/null' EXIT INT TERM HUP
export URL="http://127.0.0.1:$port/"
for _ in $(seq 1 120); do curl -sf "$URL" > /dev/null && break; sleep 1; done
mkdir -p docs/verification/uiaudit1/hud
for n in 1 2 3; do npx tsx scripts/measureHudCoverage.ts "docs/verification/uiaudit1/hud/run$n.json" --url "$URL" | grep -E "1280x800" ; done
