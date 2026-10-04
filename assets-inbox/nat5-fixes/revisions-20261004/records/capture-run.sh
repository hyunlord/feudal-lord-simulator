#!/usr/bin/env bash
set -euo pipefail
cd /home/hyunlord/fls-art-review/astra-nat5-two-revisions-20261004
export FLS_CHROMIUM_PATH=$(cat /home/hyunlord/fls-runs/_tools/chromium-path)
export FLS_PLAYWRIGHT_CORE=/home/hyunlord/fls-runs/_tools/node_modules/playwright-core/index.mjs
export PLAYWRIGHT_MODULE=$PWD/scripts/remote/playwright-chrome-shim.mjs
export REVIEW_ROCK_PATH=$PWD/candidates/rock-$1.png
node_modules/.bin/vite --config capture-vite.config.ts --host 127.0.0.1 --port 4397 --strictPort > .remote/vite-$1.log 2>&1 &
vite_pid=$!
trap 'kill "$vite_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 60); do curl -fs http://127.0.0.1:4397/ >/dev/null && break; sleep 1; done
node_modules/.bin/tsx scripts/captureNat5Review.ts http://127.0.0.1:4397/ proofs "$1" river-rock-grass chalk-summer
