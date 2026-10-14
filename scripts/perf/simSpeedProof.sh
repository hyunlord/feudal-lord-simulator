#!/usr/bin/env bash
# SIM-SPEED (user order 2026-10-11): one commit's proof set and times, each part alone so its time is the engine's:
#   1. the guardrail (tasks.sh guardrail: seeds 1–5 to 1,200,000 ticks and the human path) — finalStateSha256 per seed;
#   2. the engine's 20 seeds × 60 years (scripts/growBlockProbe.ts, all at once as the engine runs it) — each JSON's SHA-256;
#   3. lord mode, seeds 1–3 × 30 years (scripts/perf/simIdentity.ts) — the whole state's hash every year and at the end.
# Writes .remote/sim-proof/proof.json (hashes and seconds); two commits' proof.json are compared with
# scripts/perf/simProofCompare.mjs. Run on the DGX as an experiment:
#   scripts/remote/run.sh infra-SIMSPEED-<what> --experiment --detach --keep -- bash scripts/perf/simSpeedProof.sh [--parts 1,2,3]
set -uo pipefail
parts=1,2,3; [ "${1:-}" = --parts ] && parts=$2
out=.remote/sim-proof; mkdir -p "$out"
T=node_modules/.bin/tsx
now() { date +%s; }
has() { case ",$parts," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }
if has 1; then
  s=$(now); bash scripts/remote/tasks.sh guardrail > "$out/guardrail.log" 2>&1; echo "guardrail exit $? $(( $(now) - s ))s" | tee "$out/guardrail.time"
fi
if has 2; then
  mkdir -p "$out/grow60"; s=$(now)
  # SIM_GROW_BATCH=10: ten at a time (scripts/perf/simSpeedPair.sh runs two commits side by side within the slot's memory).
  batch=${SIM_GROW_BATCH:-20}
  for first in $(seq 1 "$batch" 20); do
    for seed in $(seq "$first" $(( first + batch - 1 > 20 ? 20 : first + batch - 1 ))); do ( a=$(now); $T scripts/growBlockProbe.ts "$seed" 60 > "$out/grow60/m-$seed.json"; echo "$? $(( $(now) - a ))" > "$out/grow60/m-$seed.exit" ) & done; wait
  done
  echo "grow60 $(( $(now) - s ))s" | tee "$out/grow60.time"
fi
if has 3; then
  mkdir -p "$out/lord30"; s=$(now)
  for seed in 1 2 3; do $T scripts/perf/simIdentity.ts "$seed" 30 > "$out/lord30/s-$seed.json" & done; wait
  echo "lord30 $(( $(now) - s ))s" | tee "$out/lord30.time"
fi
node scripts/perf/simProofCompare.mjs --write "$out"
