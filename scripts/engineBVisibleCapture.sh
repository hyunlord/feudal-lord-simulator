#!/usr/bin/env bash
# Existing actual checkpoint directory on DGX; no state generator or simulation.
set -euo pipefail
checkpoints=${1:-docs/verification/eb-weight/checkpoint15/saves}
manifest_sha=${2:-20afdb37bf07735499d25fc5c59a82c527097b06267b3ec17e4a7553a426cd9e}
out=${3:-.remote/eb-visible}
: "${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}"
: "${PLAYWRIGHT_MODULE:?existing playwright-core module path required}"
. scripts/remote/devServers.sh
mkdir -p "$out"
fls_serve .remote/eb-visible-vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
url="http://127.0.0.1:$FLS_REMOTE_PORT/"
for _ in $(seq 1 90); do
  if curl -sf "$url" > /dev/null; then break; fi
  sleep 1
done
curl -sf "$url" > /dev/null
node_modules/.bin/tsx scripts/engineBVisibleCapture.mjs "$checkpoints" "$manifest_sha" "$out" "$url" 2>&1 | tee .remote/eb-visible.log
