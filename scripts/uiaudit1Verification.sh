#!/usr/bin/env bash
# UI-AUDIT-1 gates on the DGX: UI-6's regression set (skin audit with the chapter 3–5 blocks, HUD area with the 1280
# budgets of UIAUDIT-D1, slot chips, tutorial, touch targets, B9 / touch / gamepad replays, focus) into
# docs/verification/uiaudit1/ui6, this build beside the trunk before it:
#   scripts/remote/run.sh render-UIAUDIT-reg-<sha7> --detach --keep -- bash scripts/uiaudit1Verification.sh <base-sha>
# The base worktree lives outside the run folder and neither Vite watches files (scripts/remote/viteNoWatch.config.ts):
# two watching servers pass the DGX's 65536 inotify watches (ENOSPC).
set -u
base_sha=${1:?base sha}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
base_port=$((port + 50))
dir=${TMPDIR:-/tmp}/fls-base-$port
git worktree remove --force "$dir" 2>/dev/null || true
git worktree add -q --detach "$dir" "$base_sha"
ln -sfn "$PWD/node_modules" "$dir/node_modules"
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite-this.log 2>&1 &
this=$!
# The base may predate the no-watch config: its own default config then (one watching server stays under the limit).
if [ -f "$dir/scripts/remote/viteNoWatch.config.ts" ]; then base_config=(--config scripts/remote/viteNoWatch.config.ts); else base_config=(); fi
(cd "$dir" && exec node_modules/.bin/vite "${base_config[@]}" --host 127.0.0.1 --port "$base_port" --strictPort) > .remote/vite-base.log 2>&1 &
base=$!
trap 'kill $this $base 2>/dev/null; git worktree remove --force "$dir" 2>/dev/null || true' EXIT INT TERM HUP
export URL="http://127.0.0.1:$port/" BASE_URL="http://127.0.0.1:$base_port/"
for url in "$URL" "$BASE_URL"; do
  for _ in $(seq 1 120); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
done
echo "this $URL · base $BASE_URL ($base_sha)"
UI6_OUT=docs/verification/uiaudit1/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} \
  UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=${UI9_STATES:-$HOME/fls-ui9-states} UI10_STATES=${UI10_STATES:-$HOME/fls-ui10-states} \
  bash scripts/ui6Verification.sh all
