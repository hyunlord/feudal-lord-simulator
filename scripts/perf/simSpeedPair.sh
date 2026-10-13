#!/usr/bin/env bash
# SIM-SPEED: one commit against another in one run — each part of scripts/perf/simSpeedProof.sh for both commits at the
# same time, so their times share the machine's load (a shared DGX moves single-run times by half), and the hashes are
# compared at the end (scripts/perf/simProofCompare.mjs). This run folder is the new commit; the base is a worktree of it.
#   scripts/remote/run.sh infra-SIMSPEED-pair-<what> --experiment --detach --keep -- bash scripts/perf/simSpeedPair.sh <base sha> [--parts 1,2,3]
set -uo pipefail
base=${1:?base commit}; shift
parts=1,2,3; [ "${1:-}" = --parts ] && parts=$2
wt=$PWD/.remote/pair-base
rm -rf "$wt"; git worktree prune; git worktree add -q --detach "$wt" "$base" || exit 2
ln -s "$PWD/node_modules" "$wt/node_modules"
export SIM_GROW_BATCH=10   # two commits × 20 seeds at once would pass the slot's 48 GB (a 60-year seed reaches ~1.3 GB)
for part in ${parts//,/ }; do
  ( cd "$wt" && bash scripts/perf/simSpeedProof.sh --parts "$part" > /dev/null 2>&1 ) &
  bash scripts/perf/simSpeedProof.sh --parts "$part" > /dev/null 2>&1 &
  wait
  echo "part $part: base $(cat "$wt/.remote/sim-proof/"*.time | tr '\n' ' ') | new $(cat .remote/sim-proof/*.time | tr '\n' ' ')"
done
node scripts/perf/simProofCompare.mjs --write "$wt/.remote/sim-proof" > /dev/null
node scripts/perf/simProofCompare.mjs --write .remote/sim-proof > /dev/null
cp "$wt/.remote/sim-proof/proof.json" .remote/sim-proof/base-proof.json
node scripts/perf/simProofCompare.mjs .remote/sim-proof/base-proof.json .remote/sim-proof/proof.json; rc=$?
git worktree remove --force "$wt"
exit $rc
