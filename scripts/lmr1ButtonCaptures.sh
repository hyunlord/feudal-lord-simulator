#!/usr/bin/env bash
# LM-R1 buttons evidence on the DGX: serves this run folder and the trunk before (with the no-watch dev server,
# scripts/remote/viteNoWatch.config.ts) and runs scripts/lmr1ButtonCaptures.mjs on each ("after" whole; "before" the
# gallery at 1280 x 800 DPR 1). Raw clips to .remote/lmr1-buttons/ (composed on the Mac by scripts/lmr1ButtonSheets.py), numbers to
# docs/verification/lmr1/buttons/captures-<label>.json.
#   scripts/remote/run.sh render-LMR1-buttons-<sha7> -- bash scripts/lmr1ButtonCaptures.sh <base-sha|->
set -euo pipefail
base_sha=$1
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
raw=.remote/lmr1-buttons; out=docs/verification/lmr1/buttons
mkdir -p "$raw" "$out"
serve() { node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$1" --strictPort; }
up() { for _ in $(seq 1 90); do curl -sf "$1" > /dev/null && return 0; sleep 1; done; echo "vite did not come up on $1"; return 1; }
serve "$port" > .remote/vite-this.log 2>&1 &
pids=$!
dir=.remote/base-build
if [ "$base_sha" != "-" ]; then
  git worktree remove --force "$dir" 2>/dev/null || true
  git worktree add -q --detach "$dir" "$base_sha"
  ln -sfn "$PWD/node_modules" "$dir/node_modules"
  rm -rf "$dir/assets-inbox" && cp -al "$PWD/assets-inbox" "$dir/assets-inbox"
  cp scripts/remote/viteNoWatch.config.ts "$dir/scripts/remote/viteNoWatch.config.ts"
  (cd "$dir" && serve $((port + 50))) > .remote/vite-base.log 2>&1 &
  pids="$pids $!"
fi
trap 'kill $pids 2>/dev/null; git worktree remove --force "$dir" 2>/dev/null || true' EXIT
up "http://127.0.0.1:$port/"
node scripts/lmr1ButtonCaptures.mjs "http://127.0.0.1:$port/" "$raw" "$out/captures-after.json" --label after
if [ "$base_sha" != "-" ]; then
  up "http://127.0.0.1:$((port + 50))/"
  node scripts/lmr1ButtonCaptures.mjs "http://127.0.0.1:$((port + 50))/" "$raw" "$out/captures-before.json" --label before --only gallery --views 1280-dpr1
fi
