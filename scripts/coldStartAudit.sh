#!/usr/bin/env bash
# UX-0b cold start audit browser on the DGX (method: docs/verification/ux0b/REPORT.md):
#   scripts/remote/run.sh render-UX0b --detach -- bash scripts/coldStartAudit.sh <out-dir> [states]
# Serves this tree with Vite on FLS_REMOTE_PORT and the step driver (scripts/coldStartDriver.mjs) on
# FLS_REMOTE_PORT + 50, both on 127.0.0.1; the auditor reaches the driver through an ssh tunnel. With "states", the
# seed 2 chapter 1 moments (scripts/ui4ChapterStates.ts, the bot) are written first for the driver's "scene" op.
# Ends on "quit".
set -euo pipefail
out=${1:-.remote/audit}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
if [ "${2:-}" = "states" ]; then npx tsx scripts/ui4ChapterStates.ts 2 90000 .remote/states > .remote/states.log 2>&1; fi
node_modules/.bin/vite --host 127.0.0.1 --port "$port" --strictPort > .remote/vite.log 2>&1 &
vite=$!
trap 'kill $vite 2>/dev/null' EXIT
for _ in $(seq 1 90); do curl -sf "http://127.0.0.1:$port/" > /dev/null && break; sleep 1; done
curl -sf "http://127.0.0.1:$port/" > /dev/null || { echo "vite did not come up on $port"; exit 1; }
echo "driver port $((port + 50))"
node scripts/coldStartDriver.mjs "$out" --url "http://127.0.0.1:$port/" --port $((port + 50)) --states .remote/states
