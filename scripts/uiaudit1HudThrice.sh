#!/usr/bin/env bash
# UI-AUDIT-1: the HUD area measured three times on one build. HUD-MEDIAN (user decision 2026-10-02): a row passes when
# the median of its three runs is within budget (was: all three within budget). Writes
# docs/verification/uiaudit1/hud/run{1,2,3}.json (each run's own pass is kept but is not the gate), then
# scripts/hudMedian.ts writes median.json and prints every row (run1 run2 run3 → median / budget); its exit is this
# script's.
#   scripts/remote/run.sh render-UIAUDIT-hud3-<sha7> --detach -- bash scripts/uiaudit1HudThrice.sh
set -u
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh   # the server stops on any exit, failures and a stopped run included
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
export URL="http://127.0.0.1:$port/"
for _ in $(seq 1 120); do curl -sf "$URL" > /dev/null && break; sleep 1; done
out=docs/verification/uiaudit1/hud
mkdir -p "$out"
for n in 1 2 3; do
  # A run over budget exits 1; the other runs still measure (the median is the gate).
  npx tsx scripts/measureHudCoverage.ts "$out/run$n.json" --url "$URL" > ".remote/hud-run$n.log" 2>&1
  echo "run $n exit $? ($(grep -c OVER ".remote/hud-run$n.log") rows over budget)"
  grep -E "1280x800" ".remote/hud-run$n.log"
done
npx tsx scripts/hudMedian.ts "$out"
