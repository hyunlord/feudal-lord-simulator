#!/usr/bin/env bash
# LM-R3 (lmr3-brand): the logo on the loading screen, the pause menu's seal and the favicon (scripts/lmr3BrandCapture.mjs)
# on the DGX's dev server.
#   scripts/remote/run.sh render-LMR3-brand-capture-<sha7> --light -- bash scripts/lmr3BrandCapture.sh [<outDir>]
set -u
. scripts/remote/devServers.sh
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/brand-vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
node scripts/lmr3BrandCapture.mjs "${1:-docs/verification/lmr3/brand}" --url "http://127.0.0.1:$port/"
