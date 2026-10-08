#!/usr/bin/env bash
# LM-R3: the welcome and the house choice (scripts/lmr3StartCaptures.mjs) on the DGX's dev server.
#   scripts/remote/run.sh render-LMR3-start-captures-<sha7> --light -- bash scripts/lmr3StartCaptures.sh [<outDir>]
set -u
. scripts/remote/devServers.sh
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/lmr3-start-vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
node scripts/lmr3StartCaptures.mjs "${1:-docs/verification/lmr3/lmr3-start}" --url "http://127.0.0.1:$port/"
