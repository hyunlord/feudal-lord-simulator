#!/usr/bin/env bash
# LM-R1: the welcome at 1280×720 (scripts/lmr1WelcomeCapture.mjs) on the DGX's dev server.
#   scripts/remote/run.sh render-LMR1-welcome-<sha7> -- bash scripts/lmr1WelcomeCapture.sh [<outDir>]
set -u
. scripts/remote/devServers.sh
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/welcome-vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
node scripts/lmr1WelcomeCapture.mjs "${1:-docs/verification/lmr1/welcome}" --url "http://127.0.0.1:$port/"
