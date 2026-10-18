#!/usr/bin/env bash
set -euo pipefail
[[ $(uname -s) == Linux && ${FLS_REMOTE:-} == 1 ]]
base=e18c0d248
repo=$PWD
out="$repo/.remote/eb-petition-expiry"
mkdir -p "$out"
node --import tsx --test tests/politicalPetitionExpiry.test.ts > "$out/boundary-tests.log" 2>&1
npm run typecheck > "$out/typecheck.log" 2>&1
scratch=$(mktemp -d)
trap 'git worktree remove --force "$scratch/base"; rmdir "$scratch"' EXIT
git worktree add --detach "$scratch/base" "$base"
ln -s "$repo/node_modules" "$scratch/base/node_modules"
git rev-parse HEAD > "$out/changed-revision.txt"
git rev-parse "$base" > "$out/baseline-revision.txt"
pids=()
for mode in sandbox lord; do
  seeds='1 2 3 4 5'
  if [[ $mode == lord ]]; then seeds='1 2 3'; fi
  for seed in $seeds; do
    (
      for side in baseline changed; do
        tree=$repo
        [[ $side != baseline ]] || tree="$scratch/base"
        dest="$out/$side/$mode/seed-$seed"
        mkdir -p "$dest"
        cd "$tree"
        rc=0
        if [[ $mode == sandbox ]]; then
          node --import tsx scripts/efficientGrowthRun.ts 24 1200000 "$dest" "$seed" > "$dest.log" 2>&1 || rc=$?
          mv "$dest.log" "$dest/run.log"
          [[ -s "$dest/summary.json" && -s "$dest/final-state.json" ]]
        else
          node --import tsx scripts/lordSliceRun.ts "$seed" 30 through > "$dest/result.json" 2> "$dest/run.log" || rc=$?
          [[ $rc == 0 && -s "$dest/result.json" ]]
        fi
        printf '%s\n' "$rc" > "$dest/exit-code"
      done
    ) &
    pids+=("$!")
  done
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
[[ $failed == 0 ]]
cd "$repo"
node --input-type=module - "$out" <<'JS'
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=process.argv[2],rows=[];
for(const mode of ['sandbox','lord'])for(let seed=1;seed<=(mode==='sandbox'?5:3);seed++){
 const read=side=>{const p=path.join(root,side,mode,`seed-${seed}`);if(mode==='sandbox'){const raw=fs.readFileSync(path.join(p,'final-state.json'));const s=JSON.parse(fs.readFileSync(path.join(p,'summary.json')));return {hash:crypto.createHash('sha256').update(raw).digest('hex'),tick:JSON.parse(raw).tick,stop:s.stopReason,guardrailPassed:s.simulationPassed,exitCode:fs.readFileSync(path.join(p,'exit-code'),'utf8').trim()};}const s=JSON.parse(fs.readFileSync(path.join(p,'result.json')));assert.equal(s.tick,120000);return {hash:s.stateSha256,tick:s.tick,finalYear:s.finalYear};};
 const baseline=read('baseline'),changed=read('changed');rows.push({mode,seed,baseline,changed,identical:baseline.hash===changed.hash&&baseline.tick===changed.tick});
}
const result={baseline:fs.readFileSync(path.join(root,'baseline-revision.txt'),'utf8').trim(),changed:fs.readFileSync(path.join(root,'changed-revision.txt'),'utf8').trim(),scope:'full state; no excluded fields; sandbox standard run termination and lord 30 years',rows,pass:rows.every(r=>r.identical)};fs.writeFileSync(path.join(root,'comparison.json'),JSON.stringify(result,null,2)+'\n');assert.ok(result.pass,'State hash mismatch');
JS
