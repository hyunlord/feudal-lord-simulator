#!/usr/bin/env bash
# TEST-1 on the DGX: the INSTALL-15 "held chunk raster … stepped blend" test with every timer waking 30 ms late (a busy
# machine), the trunk's version (the wall clock) and this one (a fake clock), then this one 100 times in a row.
#   scripts/remote/run.sh render-TEST1 -- bash scripts/test1Verification.sh <trunk-sha>
set -u
base=$1
out=docs/verification/test1
mkdir -p "$out"
git show "$base:tests/seasonArt.test.ts" > tests/seasonArtBase.tmp.test.ts
npx tsx --import ./scripts/test1LateTimers.mjs --test tests/seasonArtBase.tmp.test.ts > "$out/before-late-timers.log" 2>&1; before=$?
rm -f tests/seasonArtBase.tmp.test.ts
npx tsx --import ./scripts/test1LateTimers.mjs --test tests/seasonArt.test.ts > "$out/after-late-timers.log" 2>&1; after=$?
pass=0
for run in $(seq 1 100); do npx tsx --test tests/seasonArt.test.ts > /dev/null 2>&1 && pass=$((pass + 1)); done
printf '{"base": "%s", "beforeLateTimersExit": %d, "afterLateTimersExit": %d, "repeatRuns": 100, "repeatPass": %d}\n' "$base" "$before" "$after" "$pass" > "$out/summary.json"
cat "$out/summary.json"
