#!/usr/bin/env bash
# VIS-1 on the DGX: the lord's slice at 10x in the browser for twenty years (scripts/visibleChangeRun.mjs), then the
# engine's facts by the season from its saved states (scripts/visibleChangeFacts.ts).
#   scripts/remote/run.sh render-VIS-run-<sha7> --heavy --detach -- bash scripts/visibleChangeRun.sh [out] [years]
set -u
out=${1:-.remote/visible-change}
years=${2:-20}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite.log 2>&1 &
vite=$!
trap 'kill $vite 2>/dev/null' EXIT
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/visibleChangeRun.mjs "$out" --url "$url" --years "$years" 2>&1 | tee .remote/visible-change-run.log
code=${PIPESTATUS[0]}
[ "$code" = 0 ] || exit "$code"
if [ -f scripts/visibleChangeFacts.ts ]; then node_modules/.bin/tsx scripts/visibleChangeFacts.ts "$out" > "$out/facts.json" 2> .remote/visible-change-facts.log || exit 1; fi
