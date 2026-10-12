#!/usr/bin/env bash
# GROW-BLOCK-2a: the lord mode's growth gate — seeds 1–10 for 60 years in parallel, then the judge (exit 0 pass, 1 fail).
# Heavy (about 2–2.5 hours on the DGX with ten processes): run it through scripts/remote/run.sh, not on the Mac.
#   bash scripts/growthGateRun.sh [out dir]
set -u
out=${1:-output/growth-gate}
mkdir -p "$out"
pids=()
for seed in 1 2 3 4 5 6 7 8 9 10; do
  node_modules/.bin/tsx scripts/growBlockProbe.ts "$seed" 60 > "$out/m-$seed.json" 2> "$out/m-$seed.log" &
  pids+=($!)
done
rc=0
for pid in "${pids[@]}"; do wait "$pid" || rc=$?; done
if [ "$rc" -ne 0 ]; then echo "growth gate: a probe failed (exit $rc)"; exit 2; fi
node_modules/.bin/tsx scripts/growthGate.ts "$out" | tee "$out/verdict.txt"
exit "${PIPESTATUS[0]}"
