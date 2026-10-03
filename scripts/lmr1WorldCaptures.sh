#!/usr/bin/env bash
# LM-R1 world evidence on the DGX: serves this run folder with the no-watch dev server (scripts/remote/viteNoWatch.config.ts),
# then runs scripts/lmr1WorldCaptures.ts on it. Section "town" alone builds the lord-mode town (no server needed).
#   scripts/remote/run.sh render-LMR1-world-<sha7> [--detach] -- bash scripts/lmr1WorldCaptures.sh <out dir> [section ...]
set -euo pipefail
out=$1; shift
if [ "$*" = "town" ]; then exec node_modules/.bin/tsx scripts/lmr1WorldCaptures.ts - "$out" town; fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite-this.log 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null' EXIT
for _ in $(seq 1 90); do curl -sf "http://127.0.0.1:$port/" > /dev/null && break; sleep 1; done
node_modules/.bin/tsx scripts/lmr1WorldCaptures.ts "http://127.0.0.1:$port/" "$out" "$@"
