#!/usr/bin/env bash
# Usage: bash scripts/engineBInertNative.sh EXPECTED_SHA BASELINE_SHA LOCK_SHA
# Extracted without semantic changes from the official command in:
# docs/verification/eb-inert/native/official/run.log.gz
# Original run: engineB-inert-native-72c77f6 (baseline db750c16486a283e7f320ceaca70504589a00f93).
# Decoded command body SHA256: 321fd6fbff75d0b39288d12c01d7797e45d983bdbf65085c29517ccdc36670f4
# The retained output directory must not exist; there is no retry or overwrite path.
set -euo pipefail
expected=$1; baseline=$2; lock=$3
repo=$PWD
[[ $(uname -s) == Linux && $(uname -m) == aarch64 && $(node -v) == v24.21.0 ]]
[[ $(git rev-parse HEAD) == "$expected" && ${FULL_SHA:-} == "$expected" && ${DIRTY:-1} == 0 ]]
[[ -z $(git status --porcelain --untracked-files=no) ]]
[[ $(sha256sum package-lock.json | awk '{print $1}') == "$lock" ]]
[[ $(git show "$baseline:package-lock.json" | sha256sum | awk '{print $1}') == "$lock" ]]
git cat-file -e "$baseline^{commit}"
out="$repo/.remote/eb-inert-native-paired"
mkdir "$out"
printf '%s\n' "baseline=$baseline" "changed=$expected" "lockSha256=$lock" "node=$(node -v)" "nodePath=$(command -v node)" "nodeSha256=$(sha256sum "$(command -v node)" | awk '{print $1}')" "platform=$(uname -sm)" 'scope=24lots max1200000ticks seeds1,2,3,4,5 not-standard-guardrail' > "$out/provenance.txt"
scratch=$(mktemp -d "${TMPDIR:-/tmp}/eb-inert-native.XXXXXX")
worktree="$scratch/baseline"
pids=()
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  if [[ -d "$worktree" ]]; then git -C "$repo" worktree remove --force "$worktree" || rc=1; fi
  rmdir "$scratch" || rc=1
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
GIT_LFS_SKIP_SMUDGE=1 git worktree add --detach "$worktree" "$baseline"
ln -s "$repo/node_modules" "$worktree/node_modules"
failed=0
for side in baseline changed; do
  tree=$repo; sha=$expected
  if [[ "$side" == baseline ]]; then tree=$worktree; sha=$baseline; fi
  [[ $(git -C "$tree" rev-parse HEAD) == "$sha" ]]
  [[ -z $(git -C "$tree" status --porcelain --untracked-files=no) ]]
  mkdir "$out/$side"
  git -C "$tree" ls-tree -r HEAD src scripts package.json package-lock.json > "$out/$side/source-tree.txt"
  pids=()
  for seed in 1 2 3 4 5; do
    (cd "$tree"; exec node --import tsx scripts/efficientGrowthRun.ts 24 1200000 "$out/$side/seed-$seed" "$seed" --checkpoint) > "$out/$side/seed-$seed.log" 2>&1 &
    pids+=("$!")
  done
  for seed in 1 2 3 4 5; do
    rc=0; wait "${pids[$((seed-1))]}" || rc=$?
    printf '%s\n' "$rc" > "$out/$side/seed-$seed.exit-code"
    if [[ "$rc" != 0 ]]; then failed=1; fi
  done
  pids=()
done
rc=0
node --input-type=module - "$out" <<'JS' || rc=$?
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const out=process.argv[2]; const rows=[];let failed=false;
for (const seed of [1,2,3,4,5]) {
 const sides={};
 for(const side of ['baseline','changed']) {
  try {
   const raw=readFileSync(`${out}/${side}/seed-${seed}/final-state.json`);
   const state=JSON.parse(raw); const summary=JSON.parse(readFileSync(`${out}/${side}/seed-${seed}/summary.json`));
   const hash=createHash('sha256').update(raw).digest('hex');
   const exitCode=Number(readFileSync(`${out}/${side}/seed-${seed}.exit-code`));
   if(hash!==summary.finalStateSha256 || state.seed!==seed || exitCode!==0) failed=true;
   sides[side]={exitCode,tick:state.tick,sha256:hash,reportedSha256:summary.finalStateSha256,stopReason:summary.stopReason,simulationPassed:summary.simulationPassed};
  } catch(error) {failed=true;sides[side]={error:String(error)};}
 }
 const equal=!!sides.baseline.sha256 && sides.baseline.sha256===sides.changed.sha256;
 if(!equal) failed=true;
 rows.push({seed,rawFinalStateEqual:equal,sides});
}
writeFileSync(`${out}/comparison.json`,JSON.stringify({scope:'24lots max1200000ticks seeds1,2,3,4,5',standardGuardrail:false,rawFinalStateAllEqual:rows.every(r=>r.rawFinalStateEqual),failed,rows},null,2)+'\n',{flag:'wx'});
if(failed)process.exitCode=1;
JS
if [[ "$rc" != 0 ]]; then failed=1; fi
printf '%s\n' "$failed" > "$out/aggregate-exit-code"
exit "$failed"
