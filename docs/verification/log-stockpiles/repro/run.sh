#!/usr/bin/env bash
set -euo pipefail
source scripts/remote/devServers.sh
out="output/rb-log-stockpiles-${1:?before or after}"
mkdir -p "$out"
fls_serve "$out/vite.log" --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
for attempt in $(seq 1 60); do curl -sf "http://127.0.0.1:$FLS_REMOTE_PORT/" >/dev/null && break; sleep 1; done
node .omo/log-stockpiles/capture.mjs "$out" "http://127.0.0.1:$FLS_REMOTE_PORT/"
